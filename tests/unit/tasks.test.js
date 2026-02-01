import { describe, test, expect, afterEach } from "bun:test";
import { readTasksFile, parseTasksFile, extractTasksContent, writeTasksFile } from "../../src/utils/tasks.js";
import { unlink } from "node:fs/promises";

describe("readTasksFile", () => {
  test("should read existing TASKS.md file", async () => {
    const content = await readTasksFile("tests/fixtures/sample-tasks.md");
    expect(content).toBeString();
    expect(content).toContain("# Sample Project Tasks");
    expect(content).toContain("Task 1.1");
  });

  test("should read empty TASKS.md file", async () => {
    const content = await readTasksFile("tests/fixtures/empty-tasks.md");
    expect(content).toBeString();
    expect(content).toContain("# Empty Task List");
  });

  test("should throw error for missing file", async () => {
    await expect(readTasksFile("nonexistent.md")).rejects.toThrow();
  });

  test("should handle null path", async () => {
    await expect(readTasksFile(null)).rejects.toThrow();
  });

  test("should handle undefined path", async () => {
    await expect(readTasksFile(undefined)).rejects.toThrow();
  });

  test("should handle empty string path", async () => {
    await expect(readTasksFile("")).rejects.toThrow();
  });
});

describe("parseTasksFile", () => {
  test("should parse completed checkboxes", () => {
    const content = "- [x] Completed task\n- [ ] Incomplete task";
    const tasks = parseTasksFile(content);
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(2);
    expect(tasks[0].completed).toBe(true);
    expect(tasks[0].description).toBe("Completed task");
    expect(tasks[1].completed).toBe(false);
    expect(tasks[1].description).toBe("Incomplete task");
  });

  test("should parse incomplete checkboxes", () => {
    const content = "- [ ] First task\n- [ ] Second task\n- [ ] Third task";
    const tasks = parseTasksFile(content);
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(3);
    expect(tasks.every(t => t.completed === false)).toBe(true);
  });

  test("should extract task descriptions", () => {
    const content = "- [x] Create directory structure\n- [ ] Initialize package.json";
    const tasks = parseTasksFile(content);
    expect(tasks[0].description).toBe("Create directory structure");
    expect(tasks[1].description).toBe("Initialize package.json");
  });

  test("should handle mixed indentation", () => {
    const content = "- [x] Top level task\n  - [ ] Nested task\n    - [ ] Deeply nested";
    const tasks = parseTasksFile(content);
    expect(tasks.length).toBe(3);
    expect(tasks[0].description).toBe("Top level task");
    expect(tasks[1].description).toBe("Nested task");
    expect(tasks[2].description).toBe("Deeply nested");
  });

  test("should ignore non-checkbox lines", () => {
    const content = "# Header\n- [x] Task 1\nSome text\n- [ ] Task 2";
    const tasks = parseTasksFile(content);
    expect(tasks.length).toBe(2);
    expect(tasks[0].description).toBe("Task 1");
    expect(tasks[1].description).toBe("Task 2");
  });

  test("should handle empty content", () => {
    const tasks = parseTasksFile("");
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(0);
  });

  test("should handle content with no checkboxes", () => {
    const content = "# Just a title\n\nSome text\n\nMore text";
    const tasks = parseTasksFile(content);
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(0);
  });

  test("should handle null content", () => {
    const tasks = parseTasksFile(null);
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(0);
  });

  test("should handle undefined content", () => {
    const tasks = parseTasksFile(undefined);
    expect(tasks).toBeArray();
    expect(tasks.length).toBe(0);
  });

  test("should preserve order of tasks", () => {
    const content = "- [x] First\n- [ ] Second\n- [x] Third\n- [ ] Fourth";
    const tasks = parseTasksFile(content);
    expect(tasks[0].description).toBe("First");
    expect(tasks[1].description).toBe("Second");
    expect(tasks[2].description).toBe("Third");
    expect(tasks[3].description).toBe("Fourth");
  });
});

describe("extractTasksContent", () => {
  test("should extract content between delimiters", () => {
    const response = `Some analysis here...

---BEGIN TASKS.MD---
# Tasks
- [ ] Task 1
- [ ] Task 2
---END TASKS.MD---

**AGENT COMPLETE**`;

    const content = extractTasksContent(response);
    expect(content).toBe("# Tasks\n- [ ] Task 1\n- [ ] Task 2");
  });

  test("should return null when no delimiters found", () => {
    const response = "Just some text without delimiters";
    const content = extractTasksContent(response);
    expect(content).toBeNull();
  });

  test("should return null when only begin delimiter found", () => {
    const response = "---BEGIN TASKS.MD---\nSome content";
    const content = extractTasksContent(response);
    expect(content).toBeNull();
  });

  test("should return null when only end delimiter found", () => {
    const response = "Some content\n---END TASKS.MD---";
    const content = extractTasksContent(response);
    expect(content).toBeNull();
  });

  test("should return null when delimiters are in wrong order", () => {
    const response = "---END TASKS.MD---\nContent\n---BEGIN TASKS.MD---";
    const content = extractTasksContent(response);
    expect(content).toBeNull();
  });

  test("should handle empty content between delimiters", () => {
    const response = "---BEGIN TASKS.MD---\n---END TASKS.MD---";
    const content = extractTasksContent(response);
    expect(content).toBe("");
  });

  test("should trim whitespace from extracted content", () => {
    const response = "---BEGIN TASKS.MD---\n\n  # Tasks  \n\n---END TASKS.MD---";
    const content = extractTasksContent(response);
    expect(content).toBe("# Tasks");
  });

  test("should handle null input", () => {
    const content = extractTasksContent(null);
    expect(content).toBeNull();
  });

  test("should handle undefined input", () => {
    const content = extractTasksContent(undefined);
    expect(content).toBeNull();
  });

  test("should handle empty string input", () => {
    const content = extractTasksContent("");
    expect(content).toBeNull();
  });

  test("should handle non-string input", () => {
    const content = extractTasksContent(123);
    expect(content).toBeNull();
  });

  test("should preserve multiline content", () => {
    const response = `---BEGIN TASKS.MD---
# Project Tasks

## Phase 1
- [ ] Task A
- [ ] Task B

## Phase 2
- [ ] Task C
---END TASKS.MD---`;

    const content = extractTasksContent(response);
    expect(content).toContain("# Project Tasks");
    expect(content).toContain("## Phase 1");
    expect(content).toContain("## Phase 2");
    expect(content).toContain("- [ ] Task A");
    expect(content).toContain("- [ ] Task C");
  });
});

describe("writeTasksFile", () => {
  const testFilePath = "tests/fixtures/test-write-tasks.md";

  afterEach(async () => {
    // Clean up test file after each test
    try {
      await unlink(testFilePath);
    } catch {
      // File may not exist, ignore
    }
  });

  test("should write content to file", async () => {
    const content = "# Test Tasks\n- [ ] Task 1";
    await writeTasksFile(testFilePath, content);

    const file = Bun.file(testFilePath);
    const writtenContent = await file.text();
    expect(writtenContent).toBe(content);
  });

  test("should overwrite existing file", async () => {
    const initialContent = "# Initial\n- [ ] Old task";
    const newContent = "# Updated\n- [ ] New task";

    await writeTasksFile(testFilePath, initialContent);
    await writeTasksFile(testFilePath, newContent);

    const file = Bun.file(testFilePath);
    const writtenContent = await file.text();
    expect(writtenContent).toBe(newContent);
  });

  test("should write empty string", async () => {
    await writeTasksFile(testFilePath, "");

    const file = Bun.file(testFilePath);
    const writtenContent = await file.text();
    expect(writtenContent).toBe("");
  });

  test("should throw error for null path", async () => {
    await expect(writeTasksFile(null, "content")).rejects.toThrow("Invalid file path");
  });

  test("should throw error for undefined path", async () => {
    await expect(writeTasksFile(undefined, "content")).rejects.toThrow("Invalid file path");
  });

  test("should throw error for empty string path", async () => {
    await expect(writeTasksFile("", "content")).rejects.toThrow("Invalid file path");
  });

  test("should throw error for whitespace-only path", async () => {
    await expect(writeTasksFile("   ", "content")).rejects.toThrow("Invalid file path");
  });

  test("should throw error for null content", async () => {
    await expect(writeTasksFile(testFilePath, null)).rejects.toThrow("Content cannot be null or undefined");
  });

  test("should throw error for undefined content", async () => {
    await expect(writeTasksFile(testFilePath, undefined)).rejects.toThrow("Content cannot be null or undefined");
  });

  test("should preserve special characters", async () => {
    const content = "# Tasks\n- [ ] Handle `code` and **bold**\n- [ ] Special chars: <>&\"'";
    await writeTasksFile(testFilePath, content);

    const file = Bun.file(testFilePath);
    const writtenContent = await file.text();
    expect(writtenContent).toBe(content);
  });

  test("should preserve unicode characters", async () => {
    const content = "# Tasks 📋\n- [ ] Task with emoji 🎉\n- [ ] Unicode: áéíóú ñ 中文";
    await writeTasksFile(testFilePath, content);

    const file = Bun.file(testFilePath);
    const writtenContent = await file.text();
    expect(writtenContent).toBe(content);
  });
});

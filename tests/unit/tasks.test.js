import { describe, test, expect } from "bun:test";
import { readTasksFile, parseTasksFile } from "../../src/utils/tasks.js";

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

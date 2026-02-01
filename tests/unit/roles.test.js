import { describe, test, expect } from "bun:test";
import { loadRole } from "../../src/utils/roles.js";

describe("loadRole", () => {
  test("should load manage role with lowercase", () => {
    const prompt = loadRole("manage");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Project Management Agent");
  });

  test("should load manage role with uppercase", () => {
    const prompt = loadRole("MANAGE");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Project Management Agent");
  });

  test("should load manage role with mixed case", () => {
    const prompt = loadRole("Manage");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Project Management Agent");
  });

  test("should load plan role with lowercase", () => {
    const prompt = loadRole("plan");
    expect(prompt).toBeString();
    expect(prompt).toContain("# System Architect Agent");
  });

  test("should load plan role with uppercase", () => {
    const prompt = loadRole("PLAN");
    expect(prompt).toBeString();
    expect(prompt).toContain("# System Architect Agent");
  });

  test("should load code role with lowercase", () => {
    const prompt = loadRole("code");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Coder Agent");
  });

  test("should load code role with uppercase", () => {
    const prompt = loadRole("CODE");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Coder Agent");
  });

  test("should load document role with lowercase", () => {
    const prompt = loadRole("document");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Code Documentation Agent");
  });

  test("should load document role with uppercase", () => {
    const prompt = loadRole("DOCUMENT");
    expect(prompt).toBeString();
    expect(prompt).toContain("# Code Documentation Agent");
  });

  test("should throw error for invalid role name", () => {
    expect(() => loadRole("invalid")).toThrow();
  });

  test("should throw error for empty role name", () => {
    expect(() => loadRole("")).toThrow();
  });

  test("should throw error for null role name", () => {
    expect(() => loadRole(null)).toThrow();
  });

  test("should throw error for undefined role name", () => {
    expect(() => loadRole(undefined)).toThrow();
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listRepos } from "../../../server/config/repos.js";
import { sanitizeBaseDir } from "../../../server/config/app-config.js";

let base: string;

beforeAll(() => {
  base = mkdtempSync(path.join(os.tmpdir(), "repos-spec-"));
  mkdirSync(path.join(base, "beta-repo", ".git"), { recursive: true });
  mkdirSync(path.join(base, "alpha-plain"));
  mkdirSync(path.join(base, ".hidden"));
  writeFileSync(path.join(base, "a-file.txt"), "not a dir");
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("listRepos", () => {
  it("lists non-hidden subdirectories only, git repos first", () => {
    expect(listRepos(base)).toEqual([
      { name: "beta-repo", path: path.join(base, "beta-repo"), git: true },
      { name: "alpha-plain", path: path.join(base, "alpha-plain"), git: false },
    ]);
  });

  it("returns [] for a null, missing, or non-directory baseDir", () => {
    expect(listRepos(null)).toEqual([]);
    expect(listRepos(path.join(base, "no-such-dir"))).toEqual([]);
    expect(listRepos(path.join(base, "a-file.txt"))).toEqual([]);
  });
});

describe("sanitizeBaseDir", () => {
  it("keeps a trimmed absolute path", () => {
    expect(sanitizeBaseDir("  /home/user/repos  ")).toBe("/home/user/repos");
  });

  it("rejects relative, blank, and non-string values", () => {
    expect(sanitizeBaseDir("relative/path")).toBeNull();
    expect(sanitizeBaseDir("   ")).toBeNull();
    expect(sanitizeBaseDir(42)).toBeNull();
    expect(sanitizeBaseDir(undefined)).toBeNull();
  });
});

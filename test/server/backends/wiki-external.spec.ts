// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { walkExternalWiki, flattenWikiLinks, frontmatterTitle } from "../../../server/backends/wiki-external.js";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "wiki-ext-"));
  writeFileSync(path.join(root, "index.md"), "# idx\n- [[alpha]] — a\n");
  writeFileSync(path.join(root, "CLAUDE.md"), "rules");
  mkdirSync(path.join(root, "concepts"));
  writeFileSync(path.join(root, "concepts", "alpha.md"), "---\ntitle: Alpha Page\n---\nbody [[tech/adr/beta]] and [[gamma|label]]\n");
  mkdirSync(path.join(root, "tech", "adr"), { recursive: true });
  writeFileSync(path.join(root, "tech", "adr", "beta.md"), "beta");
  // basename collision: the shallower file must win
  writeFileSync(path.join(root, "gamma.md"), "root gamma");
  mkdirSync(path.join(root, "_archive"));
  writeFileSync(path.join(root, "_archive", "gamma.md"), "archived gamma");
  mkdirSync(path.join(root, "entities"));
  writeFileSync(path.join(root, "entities", "gamma.md"), "entity gamma");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("walkExternalWiki", () => {
  it("maps basename slugs to files across nested dirs, excluding repo plumbing", async () => {
    const map = await walkExternalWiki(root);
    expect([...map.keys()].sort()).toEqual(["alpha", "beta", "gamma"]);
    expect(map.get("alpha")?.absPath).toBe(path.join(root, "concepts", "alpha.md"));
    expect(map.get("beta")?.absPath).toBe(path.join(root, "tech", "adr", "beta.md"));
    expect(map.has("index")).toBe(false);
    expect(map.has("CLAUDE")).toBe(false);
  });

  it("prefers the shallower file on a basename collision and skips _archive", async () => {
    const map = await walkExternalWiki(root);
    expect(map.get("gamma")?.absPath).toBe(path.join(root, "gamma.md"));
  });
});

describe("flattenWikiLinks", () => {
  it("rewrites path links to their basename, keeping labels and bare links", () => {
    expect(flattenWikiLinks("see [[tech/adr/beta]] and [[alpha]]")).toBe("see [[beta]] and [[alpha]]");
    expect(flattenWikiLinks("[[concepts/alpha|the alpha page]]")).toBe("[[alpha|the alpha page]]");
  });
});

describe("frontmatterTitle", () => {
  it("reads the YAML title and returns null without frontmatter", () => {
    expect(frontmatterTitle("---\ntitle: Alpha Page\n---\nbody")).toBe("Alpha Page");
    expect(frontmatterTitle('---\ntitle: "Quoted"\n---\n')).toBe("Quoted");
    expect(frontmatterTitle("no front")).toBeNull();
  });
});

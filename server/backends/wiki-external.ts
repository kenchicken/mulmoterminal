// Read-only wiki routes over an EXTERNAL wiki repository (MULMOTERMINAL_WIKI_ROOT) —
// e.g. a standalone knowledge-base git clone — instead of the mulmoclaude workspace's
// `data/wiki/pages`. An external wiki nests pages in subdirectories (concepts/,
// entities/, tech/adr/, …) and links them by bare basename, but the shared client and
// core validator only accept FLAT slugs. So this surface flattens: a page's slug is its
// file basename, and path-style `[[dir/name]]` links are rewritten to `[[name]]` when
// serving content. Same REST shape as backends/wiki.ts, so the client needs no changes.
// Read-only by design: the wiki is edited through its own git flow, never from here.
//
// The tree is re-walked on every request (a personal wiki is ~10² files): an external
// sync (git pull / autosync cron) shows up on the next fetch with no cache to invalidate.
import type { Express, Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseIndexEntries, buildWikiGraph, isSafeWikiSlug } from "@mulmoclaude/core/wiki";

// Directories that hold sources/archives rather than pages, plus VCS internals.
const EXCLUDED_DIRS = new Set([".git", "_archive", "raw", "node_modules"]);
// Root-level repo plumbing that shouldn't list as pages.
const EXCLUDED_ROOT_FILES = new Set(["index.md", "CLAUDE.md", "SCHEMA.md"]);

export interface ExternalWikiFile {
  slug: string;
  absPath: string;
  depth: number;
}

// slug -> file, shallower path wins a basename collision (a root page beats an
// archived/nested duplicate), then lexicographic for determinism.
export async function walkExternalWiki(root: string): Promise<Map<string, ExternalWikiFile>> {
  const files: ExternalWikiFile[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!EXCLUDED_DIRS.has(e.name)) await walk(abs, depth + 1);
        continue;
      }
      if (!e.name.endsWith(".md")) continue;
      if (depth === 0 && EXCLUDED_ROOT_FILES.has(e.name)) continue;
      const slug = e.name.slice(0, -3);
      if (!isSafeWikiSlug(slug)) continue;
      files.push({ slug, absPath: abs, depth });
    }
  }
  await walk(root, 0);
  files.sort((a, b) => a.depth - b.depth || a.absPath.localeCompare(b.absPath));
  const map = new Map<string, ExternalWikiFile>();
  for (const f of files) if (!map.has(f.slug)) map.set(f.slug, f);
  return map;
}

// `[[dir/name]]` → `[[name]]` (labels after `|` preserved) so nested references keep
// working once slugs are flattened. Bare links pass through untouched.
export function flattenWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (whole, inner: string) => {
    const [target, ...label] = inner.split("|");
    if (!target.includes("/")) return whole;
    const base = target.trim().split("/").filter(Boolean).pop() ?? target;
    return `[[${[base, ...label].join("|")}]]`;
  });
}

// The `title:` of a leading YAML frontmatter block, or null.
export function frontmatterTitle(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const t = m[1].match(/^title:\s*(.+)\s*$/m);
  return t ? t[1].trim().replace(/^["']|["']$/g, "") : null;
}

export function mountExternalWikiRoutes(app: Express, deps: { root: string }): void {
  const { root } = deps;
  console.log(`[wiki] serving external wiki from ${root} (read-only, flattened slugs)`);

  const readIndex = async () => {
    const content = flattenWikiLinks(await fs.readFile(path.join(root, "index.md"), "utf8"));
    return { content, entries: parseIndexEntries(content) };
  };

  app.get("/api/wiki", async (req: Request, res: Response) => {
    const slug = req.query.slug;
    if (slug !== undefined) {
      if (typeof slug !== "string" || !isSafeWikiSlug(slug)) {
        res.status(400).json({ error: `invalid wiki slug: ${String(slug)}` });
        return;
      }
      try {
        const file = (await walkExternalWiki(root)).get(slug);
        if (!file) {
          res.status(404).json({ error: `wiki page '${slug}' not found` });
          return;
        }
        const raw = await fs.readFile(file.absPath, "utf8");
        res.json({
          filePath: file.absPath,
          content: flattenWikiLinks(raw),
          exists: true,
          resolvedTitle: frontmatterTitle(raw) ?? slug,
        });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
      return;
    }
    try {
      res.json(await readIndex());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/wiki/graph", async (_req: Request, res: Response) => {
    try {
      const files = await walkExternalWiki(root);
      const pages = await Promise.all(
        [...files.values()].map(async (f) => ({ slug: f.slug, content: flattenWikiLinks(await fs.readFile(f.absPath, "utf8")) })),
      );
      res.json(buildWikiGraph(pages, (await readIndex()).entries));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // The core lint is bound to the workspace layout; an external wiki has its own
  // conventions and its own tooling, so answer honestly instead of half-linting.
  app.get("/api/wiki/lint", (_req: Request, res: Response) => {
    res.json({ issues: [], report: "_External wiki — lint is handled by the wiki repository's own tooling._" });
  });
}

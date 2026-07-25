// The repository chooser's data source: the immediate subdirectories of the configured
// baseDir (GET /api/repos). One directory = one repository = one session cwd. Extracted
// from config-routes.ts so the listing rules are unit-testable.
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

export interface RepoEntry {
  name: string;
  path: string;
  // Whether the directory has a .git — the UI can rank/mark real repositories, but
  // non-git directories still list (not everything a session opens is a repo).
  git: boolean;
}

// Immediate, non-hidden subdirectories of baseDir, name-sorted with git repos first.
// A missing/unreadable baseDir yields [] rather than an error: the chooser simply has
// nothing to offer, and the client shows its "configure baseDir" hint.
export function listRepos(baseDir: string | null): RepoEntry[] {
  if (!baseDir) return [];
  let entries;
  try {
    entries = readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith("."))
    .map((e) => {
      const full = path.join(baseDir, e.name);
      return { name: e.name, path: full, git: existsSync(path.join(full, ".git")) };
    })
    .sort((a, b) => (a.git !== b.git ? (a.git ? -1 : 1) : a.name.localeCompare(b.name)));
}

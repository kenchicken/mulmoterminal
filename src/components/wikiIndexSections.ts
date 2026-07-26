// Group the index's page entries under the section headings of index.md, so a wiki
// whose index is organised (## クライアント / ## 案件 / ## Concepts / …) renders as that
// hierarchy instead of one flat grid. The section a page belongs to is wherever its
// `[[slug]]` bullet first appears under a `##` heading; pages the index lists outside
// any section land in a heading-less leading group. Pure — unit-tested apart from the view.
import type { WikiPageEntry } from "@mulmoclaude/core/wiki";

export interface WikiIndexSection {
  heading: string | null;
  entries: WikiPageEntry[];
}

const HEADING = /^##\s+(.+?)\s*$/;
const BULLET_LINK = /^[-*]\s+\[\[([^\]|#]+)/;

/** slug -> section heading, from the raw index.md content (first occurrence wins). */
export function sectionBySlug(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    const h = line.match(HEADING);
    if (h) {
      current = h[1];
      continue;
    }
    const b = line.trim().match(BULLET_LINK);
    if (b && current && !map.has(b[1].trim())) map.set(b[1].trim(), current);
  }
  return map;
}

/** The entries grouped in the order their sections appear in index.md. Entries whose
 *  slug has no section come first under a null heading; empty groups are dropped. */
export function groupEntriesBySection(content: string, entries: WikiPageEntry[]): WikiIndexSection[] {
  const bySlug = sectionBySlug(content);
  const order: (string | null)[] = [null];
  const groups = new Map<string | null, WikiPageEntry[]>([[null, []]]);
  for (const line of content.split("\n")) {
    const h = line.match(HEADING);
    if (h && !groups.has(h[1])) {
      order.push(h[1]);
      groups.set(h[1], []);
    }
  }
  for (const e of entries) {
    const heading = bySlug.get(e.slug) ?? null;
    (groups.get(heading) ?? groups.get(null))!.push(e);
  }
  return order.map((heading) => ({ heading, entries: groups.get(heading) ?? [] })).filter((g) => g.entries.length > 0);
}

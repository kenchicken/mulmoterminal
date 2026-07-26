import { describe, it, expect } from "vitest";
import { groupEntriesBySection, sectionBySlug } from "../../../src/components/wikiIndexSections";
import type { WikiPageEntry } from "@mulmoclaude/core/wiki";

const e = (slug: string): WikiPageEntry => ({ slug, title: slug, description: "", tags: [] });

const INDEX = `# Wiki Index

intro text

## クライアント

- [[acme]] — a client
- [[globex]] — another

## Concepts

- [[dev-environment]] — machines
* [[dev-process]] — process

## 空のセクション
`;

describe("sectionBySlug", () => {
  it("maps each bulleted slug to its nearest preceding ## heading", () => {
    const m = sectionBySlug(INDEX);
    expect(m.get("acme")).toBe("クライアント");
    expect(m.get("dev-environment")).toBe("Concepts");
    expect(m.get("dev-process")).toBe("Concepts"); // `*` bullets too
  });
});

describe("groupEntriesBySection", () => {
  it("groups entries in index section order and drops empty sections", () => {
    const groups = groupEntriesBySection(INDEX, [e("dev-environment"), e("acme"), e("globex"), e("dev-process")]);
    expect(groups.map((g) => g.heading)).toEqual(["クライアント", "Concepts"]);
    expect(groups[0].entries.map((x) => x.slug)).toEqual(["acme", "globex"]);
    expect(groups[1].entries.map((x) => x.slug)).toEqual(["dev-environment", "dev-process"]);
  });

  it("puts unsectioned entries in a leading heading-less group", () => {
    const groups = groupEntriesBySection(INDEX, [e("orphan"), e("acme")]);
    expect(groups[0].heading).toBeNull();
    expect(groups[0].entries.map((x) => x.slug)).toEqual(["orphan"]);
  });

  it("degrades to one flat heading-less group when the index has no sections", () => {
    const groups = groupEntriesBySection("- [[a]]\n- [[b]]\n", [e("a"), e("b")]);
    expect(groups).toEqual([{ heading: null, entries: [e("a"), e("b")] }]);
    const empty = groupEntriesBySection("", [e("a")]);
    expect(empty[0].entries.map((x) => x.slug)).toEqual(["a"]);
  });
});

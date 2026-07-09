import { describe, expect, test, vi } from "vitest";
import type { Project, ScriptPage, ScriptSection } from "./types";
import {
  countNotes,
  estimateSeconds,
  exportXlsx,
  isMemoPage,
  makeMarkdown,
  makePrintHtml,
  pageNumbers,
  scopePageIds
} from "./utils";

// xlsx writes to disk; capture the rows handed to json_to_sheet instead.
const xlsxCapture = vi.hoisted(() => ({ rows: [] as Array<Record<string, string | number>> }));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (rows: Array<Record<string, string | number>>) => {
      xlsxCapture.rows = rows;
      return {};
    },
    book_new: () => ({}),
    book_append_sheet: () => undefined
  },
  writeFile: () => undefined
}));

function page(overrides: Partial<ScriptPage> & { id: string }): ScriptPage {
  return {
    title: "",
    script: "",
    memo: "",
    referenceLinks: [],
    tags: [],
    ...overrides
  };
}

function section(id: string, title: string, pages: ScriptPage[]): ScriptSection {
  return { id, title, collapsed: false, pages };
}

function project(sections: ScriptSection[]): Project {
  return {
    id: "proj" as Project["id"],
    name: "테스트",
    siteName: "사업지",
    labelColor: "green",
    emoji: "📁",
    favorite: false,
    updatedAt: new Date().toISOString(),
    sections,
    projectMemos: { qa: "", caution: "", feedback: "" },
    kind: "script",
    order: 0,
    memoText: ""
  };
}

describe("isMemoPage", () => {
  test("true only when the flag is explicitly true", () => {
    expect(isMemoPage(page({ id: "a", isMemo: true }))).toBe(true);
    expect(isMemoPage(page({ id: "b", isMemo: false }))).toBe(false);
    expect(isMemoPage(page({ id: "c" }))).toBe(false);
  });
});

describe("pageNumbers", () => {
  test("numbers only non-memo pages, continuously across sections", () => {
    const proj = project([
      section("s1", "도입", [
        page({ id: "a" }),
        page({ id: "m", isMemo: true }),
        page({ id: "b" })
      ]),
      section("s2", "본론", [page({ id: "c" })])
    ]);

    const numbers = pageNumbers(proj);
    expect(numbers.get("a")).toBe(1);
    expect(numbers.get("b")).toBe(2);
    expect(numbers.get("c")).toBe(3);
    // Memo pages are absent from the map.
    expect(numbers.has("m")).toBe(false);
  });
});

describe("estimateSeconds", () => {
  test("excludes memo pages from the character count", () => {
    const withMemo = project([
      section("s1", "", [
        page({ id: "a", script: "x".repeat(460) }),
        page({ id: "m", isMemo: true, script: "y".repeat(4600) })
      ])
    ]);
    const withoutMemo = project([
      section("s1", "", [page({ id: "a", script: "x".repeat(460) })])
    ]);
    expect(estimateSeconds(withMemo)).toBe(estimateSeconds(withoutMemo));
  });

  test("returns 0 for a memo-only project (no non-memo content, no 40s floor)", () => {
    const memoOnly = project([
      section("s1", "", [
        page({ id: "m1", isMemo: true, script: "y".repeat(4600) }),
        page({ id: "m2", isMemo: true, script: "z".repeat(100) })
      ])
    ]);
    expect(estimateSeconds(memoOnly)).toBe(0);
  });

  test("returns 0 for an empty project", () => {
    expect(estimateSeconds(project([]))).toBe(0);
  });

  test("applies the 40s floor once there is any non-memo content", () => {
    const tiny = project([section("s1", "", [page({ id: "a", script: "짧음" })])]);
    expect(estimateSeconds(tiny)).toBe(40);
  });
});

describe("countNotes", () => {
  test("counts only non-memo pages across sections", () => {
    const proj = project([
      section("s1", "도입", [
        page({ id: "a" }),
        page({ id: "m", isMemo: true }),
        page({ id: "b" })
      ]),
      section("s2", "본론", [
        page({ id: "c" }),
        page({ id: "m2", isMemo: true })
      ])
    ]);
    expect(countNotes(proj)).toBe(3);
  });

  test("is 0 for a memo-only project", () => {
    const memoOnly = project([
      section("s1", "", [page({ id: "m", isMemo: true })])
    ]);
    expect(countNotes(memoOnly)).toBe(0);
  });
});

describe("makeMarkdown", () => {
  test("memo pages get a [메모] heading and do not consume page numbers", () => {
    const proj = project([
      section("s1", "도입", [
        page({ id: "a", title: "첫 노트", script: "본문 A" }),
        page({ id: "m", title: "주의사항", script: "메모 본문", isMemo: true }),
        page({ id: "b", title: "둘째 노트", script: "본문 B" })
      ])
    ]);
    const ids = new Set(["a", "m", "b"]);
    const md = makeMarkdown(proj, ids);

    expect(md).toContain("### P.1 첫 노트");
    expect(md).toContain("### [메모] 주의사항");
    expect(md).toContain("### P.2 둘째 노트");
    // The memo heading must not receive a P.N number.
    expect(md).not.toContain("### P.2 주의사항");
    expect(md).not.toContain("P.3");
  });
});

describe("exportXlsx", () => {
  test("memo pages show '메모' in the Page column and do not shift numbering", () => {
    const proj = project([
      section("s1", "", [
        page({ id: "a", title: "A" }),
        page({ id: "m", title: "M", isMemo: true }),
        page({ id: "b", title: "B" })
      ])
    ]);

    exportXlsx(proj, new Set(["a", "m", "b"]));

    expect(xlsxCapture.rows.map((row) => row.Page)).toEqual([1, "메모", 2]);
  });
});

describe("scopePageIds", () => {
  const proj = project([
    section("s1", "도입", [
      page({ id: "a" }),
      page({ id: "m", isMemo: true })
    ]),
    section("s2", "본론", [page({ id: "b" })])
  ]);

  test("'all' includes every page", () => {
    expect(scopePageIds(proj, "all")).toEqual(new Set(["a", "m", "b"]));
  });
  test("'notes' excludes memo pages", () => {
    expect(scopePageIds(proj, "notes")).toEqual(new Set(["a", "b"]));
  });
  test("'memos' keeps only memo pages", () => {
    expect(scopePageIds(proj, "memos")).toEqual(new Set(["m"]));
  });
});

describe("makePrintHtml", () => {
  test("labels memo pages with [메모] and numbers only notes", () => {
    const proj = project([
      section("s1", "도입", [
        page({ id: "a", title: "첫 노트", script: "본문 A" }),
        page({ id: "m", title: "주의사항", script: "메모 본문", isMemo: true }),
        page({ id: "b", title: "둘째 노트", script: "본문 B" })
      ])
    ]);
    const html = makePrintHtml(proj, new Set(["a", "m", "b"]));

    expect(html).toContain("<h1>테스트</h1>");
    expect(html).toContain("P.1");
    expect(html).toContain("P.2");
    expect(html).toContain("[메모]");
    // Memo must not take a page number.
    expect(html).not.toContain("P.3");
  });

  test("escapes HTML in user content", () => {
    const proj = project([
      section("s1", "", [page({ id: "a", title: "<b>x</b>", script: "a & b" })])
    ]);
    const html = makePrintHtml(proj, new Set(["a"]));
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
  });
});

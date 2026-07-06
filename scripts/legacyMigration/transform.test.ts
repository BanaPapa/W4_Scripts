import { describe, expect, test } from "vitest";
import {
  isGenericName,
  stripHtml,
  extractNameFromCuts,
  extractNameFromNotepad,
  mergeCutMemo,
  parseTimestampFromId,
  transformLegacyProject
} from "./transform";

describe("isGenericName", () => {
  test("matches auto-generated placeholder names", () => {
    expect(isGenericName("스크립트 9879")).toBe(true);
    expect(isGenericName("  스크립트 123  ")).toBe(true);
  });
  test("does not match real names", () => {
    expect(isGenericName("진주 평거센트럴")).toBe(false);
  });
});

describe("stripHtml", () => {
  test("converts divs and br tags to newlines and removes remaining tags", () => {
    const html = "<div>첫줄</div><div>둘째줄<br>셋째줄</div>";
    expect(stripHtml(html)).toBe("첫줄\n둘째줄\n셋째줄");
  });
  test("decodes common entities", () => {
    expect(stripHtml("A&nbsp;B&amp;C")).toBe("A B&C");
  });
});

describe("extractNameFromCuts", () => {
  test("returns the first non-empty cut subject", () => {
    const parts = [
      { id: "p1", title: "파트1", items: [{ id: "c1", subject: "", designNotes: "", planningNotes: "", text: "" }] },
      { id: "p2", title: "파트2", items: [{ id: "c2", subject: "오프닝 인사", designNotes: "", planningNotes: "", text: "" }] }
    ];
    expect(extractNameFromCuts(parts)).toBe("오프닝 인사");
  });
  test("returns null when nothing is found", () => {
    const parts = [{ id: "p1", title: "파트1", items: [] }];
    expect(extractNameFromCuts(parts)).toBeNull();
  });
});

describe("extractNameFromNotepad", () => {
  test("returns the first non-empty stripped line", () => {
    const panels = [{ width: 50, content: "<div><br></div><div>진주 부동산시장 소개</div>" }];
    expect(extractNameFromNotepad(panels)).toBe("진주 부동산시장 소개");
  });
});

describe("mergeCutMemo", () => {
  test("combines both notes with labels", () => {
    expect(mergeCutMemo("기획메모", "디자인메모")).toBe("[기획] 기획메모\n[디자인] 디자인메모");
  });
  test("omits missing notes", () => {
    expect(mergeCutMemo("", "디자인메모")).toBe("[디자인] 디자인메모");
    expect(mergeCutMemo("", "")).toBe("");
  });
});

describe("parseTimestampFromId", () => {
  test("parses the embedded millisecond timestamp", () => {
    expect(parseTimestampFromId("script-1758515737518-05233893693709879", "fallback")).toBe(
      new Date(1758515737518).toISOString()
    );
  });
  test("falls back when the id does not match", () => {
    expect(parseTimestampFromId("not-a-script-id", "fallback-value")).toBe("fallback-value");
  });
});

describe("transformLegacyProject", () => {
  test("maps script mode parts/cuts into sections/pages", () => {
    const entry = { id: "script-1-abc", name: "스크립트 0001", type: "script" as const };
    const content = {
      parts: [
        {
          id: "part-1",
          title: "오프닝",
          items: [
            { id: "cut-1", subject: "인사", designNotes: "느긋하게", planningNotes: "밝은 톤", text: "안녕하세요" }
          ]
        }
      ],
      notepadContent: []
    };
    const result = transformLegacyProject(entry, content, "script", "2026-01-01T00:00:00.000Z");
    expect(result.name).toBe("인사");
    expect(result.sections).toEqual([
      {
        id: "part-1",
        title: "오프닝",
        collapsed: false,
        pages: [
          {
            id: "cut-1",
            title: "인사",
            script: "안녕하세요",
            memo: "[기획] 밝은 톤\n[디자인] 느긋하게",
            referenceLinks: [],
            tags: []
          }
        ]
      }
    ]);
  });

  test("keeps a meaningful original name and merges notepad panels for notepad mode", () => {
    const entry = { id: "script-2-xyz", name: "진주 평거센트럴 메모", type: "script" as const };
    const content = {
      parts: [],
      notepadContent: [
        { width: 50, content: "<div>첫 패널</div>" },
        { width: 50, content: "<div>둘째 패널</div>" }
      ]
    };
    const result = transformLegacyProject(entry, content, "notepad", "2026-01-01T00:00:00.000Z");
    expect(result.name).toBe("진주 평거센트럴 메모");
    expect(result.sections[0].pages[0].script).toBe("첫 패널\n\n---\n\n둘째 패널");
  });
});

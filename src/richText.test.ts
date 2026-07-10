import { describe, expect, it } from "vitest";
import { encodeRichText, isRichText, mergeRichText, richTextHtml, richTextPlain } from "./richText";

const rich = (html: string) => encodeRichText(html);

describe("mergeRichText", () => {
  it("일반 텍스트끼리는 빈 줄로 잇는다", () => {
    expect(mergeRichText("가", "나")).toBe("가\n\n나");
  });

  it("빈 쪽이 있으면 다른 쪽을 그대로 돌려준다", () => {
    expect(mergeRichText("", rich("<p>가</p>"))).toBe(rich("<p>가</p>"));
    expect(mergeRichText("가", "")).toBe("가");
  });

  it("리치 텍스트끼리 병합하면 접두사가 하나만 남는다", () => {
    const merged = mergeRichText(rich("<p>가</p>"), rich("<p>나</p>"));
    expect(merged).toBe(rich("<p>가</p><p>나</p>"));
    expect(merged.indexOf("__PT_RICH_TEXT_V1__")).toBe(merged.lastIndexOf("__PT_RICH_TEXT_V1__"));
  });

  it("리치 + 일반 조합은 일반 텍스트를 HTML로 변환해 합친다", () => {
    const merged = mergeRichText(rich("<p>가</p>"), "나<다");
    expect(isRichText(merged)).toBe(true);
    expect(richTextHtml(merged)).toBe("<p>가</p>나&lt;다");
  });

  it("병합 결과에서 검색용 일반 텍스트를 온전히 추출할 수 있다", () => {
    const merged = mergeRichText(rich("<p>첫째</p>"), rich("<p>둘째</p>"));
    const plain = richTextPlain(merged);
    expect(plain).toContain("첫째");
    expect(plain).toContain("둘째");
    expect(plain).not.toContain("__PT_RICH_TEXT_V1__");
  });
});

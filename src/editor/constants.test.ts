import { describe, expect, it } from "vitest";
import {
  clampFontSize,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_PRESETS,
  fontLabelFromValue,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseFontSizePx,
  pushRecentColor,
  shadeHex,
  stepFontSize,
  themeColorVariants,
  tintHex
} from "./constants";

describe("stepFontSize", () => {
  it("프리셋 값에서 다음 단계로 이동한다", () => {
    expect(stepFontSize(18, "up")).toBe(20);
    expect(stepFontSize(18, "down")).toBe(16);
  });

  it("프리셋 사이 값에서는 가장 가까운 다음 프리셋으로 이동한다", () => {
    expect(stepFontSize(19, "up")).toBe(20);
    expect(stepFontSize(19, "down")).toBe(18);
  });

  it("경계에서 최소/최대를 넘지 않는다", () => {
    expect(stepFontSize(MAX_FONT_SIZE, "up")).toBe(MAX_FONT_SIZE);
    expect(stepFontSize(MIN_FONT_SIZE, "down")).toBe(MIN_FONT_SIZE);
    expect(stepFontSize(200, "up")).toBe(MAX_FONT_SIZE);
    expect(stepFontSize(2, "down")).toBe(MIN_FONT_SIZE);
  });

  it("모든 프리셋을 순서대로 오르내릴 수 있다", () => {
    let size = MIN_FONT_SIZE;
    for (const preset of FONT_SIZE_PRESETS.slice(1)) {
      size = stepFontSize(size, "up");
      expect(size).toBe(preset);
    }
  });
});

describe("clampFontSize / parseFontSizePx", () => {
  it("범위를 벗어난 값을 잘라낸다", () => {
    expect(clampFontSize(1)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(500)).toBe(MAX_FONT_SIZE);
    expect(clampFontSize(17.6)).toBe(18);
  });

  it("숫자가 아니면 기본 크기를 반환한다", () => {
    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE);
    expect(parseFontSizePx(undefined)).toBe(DEFAULT_FONT_SIZE);
    expect(parseFontSizePx("abc")).toBe(DEFAULT_FONT_SIZE);
  });

  it("px 문자열을 숫자로 파싱한다", () => {
    expect(parseFontSizePx("24px")).toBe(24);
    expect(parseFontSizePx("18.4px")).toBe(18);
  });
});

describe("색상 혼합", () => {
  it("tintHex는 흰색 방향으로 혼합한다", () => {
    expect(tintHex("#000000", 1)).toBe("#ffffff");
    expect(tintHex("#000000", 0.5)).toBe("#808080");
    expect(tintHex("#4472c4", 0)).toBe("#4472c4");
  });

  it("shadeHex는 검정 방향으로 혼합한다", () => {
    expect(shadeHex("#ffffff", 1)).toBe("#000000");
    expect(shadeHex("#ffffff", 0.5)).toBe("#808080");
  });

  it("테마 색 변형은 항상 5단계다", () => {
    expect(themeColorVariants("#ffffff")).toHaveLength(5);
    expect(themeColorVariants("#000000")).toHaveLength(5);
    expect(themeColorVariants("#4472c4")).toHaveLength(5);
  });

  it("흰색은 어둡게, 검정은 밝게 변형된다", () => {
    for (const variant of themeColorVariants("#ffffff")) expect(variant).not.toBe("#ffffff");
    for (const variant of themeColorVariants("#000000")) expect(variant).not.toBe("#000000");
  });
});

describe("fontLabelFromValue", () => {
  it("등록된 글꼴은 한글 이름을 돌려준다", () => {
    expect(fontLabelFromValue("'Malgun Gothic', sans-serif")).toBe("맑은 고딕");
    expect(fontLabelFromValue("Gulim, sans-serif")).toBe("굴림");
  });

  it("값이 없으면 기본 글꼴 이름을 돌려준다", () => {
    expect(fontLabelFromValue(undefined)).toBe("맑은 고딕");
    expect(fontLabelFromValue(null)).toBe("맑은 고딕");
  });

  it("모르는 글꼴은 첫 번째 패밀리 이름을 그대로 보여준다", () => {
    expect(fontLabelFromValue("'Comic Sans MS', cursive")).toBe("Comic Sans MS");
  });
});

describe("pushRecentColor", () => {
  it("맨 앞에 추가하고 중복을 제거한다", () => {
    expect(pushRecentColor(["#111111", "#222222"], "#222222")).toEqual(["#222222", "#111111"]);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const original = ["#111111"];
    pushRecentColor(original, "#333333");
    expect(original).toEqual(["#111111"]);
  });

  it("최대 개수를 넘지 않는다", () => {
    const many = Array.from({ length: 12 }, (_, index) => `#0000${index.toString().padStart(2, "0")}`);
    expect(pushRecentColor(many, "#ffffff").length).toBeLessThanOrEqual(10);
  });
});

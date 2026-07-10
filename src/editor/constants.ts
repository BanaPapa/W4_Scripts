/** PPT(파워포인트) 홈 리본과 동일한 글꼴/크기/색상 구성값. */

export interface FontOption {
  label: string;
  value: string;
}

export const FONT_FAMILIES: FontOption[] = [
  { label: "맑은 고딕", value: "'Malgun Gothic', sans-serif" },
  { label: "나눔고딕", value: "'Nanum Gothic', NanumGothic, sans-serif" },
  { label: "굴림", value: "Gulim, sans-serif" },
  { label: "돋움", value: "Dotum, sans-serif" },
  { label: "바탕", value: "Batang, serif" },
  { label: "궁서", value: "Gungsuh, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI', sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" }
];

export const DEFAULT_FONT_LABEL = "맑은 고딕";

function normalizeFamily(value: string) {
  return value.toLowerCase().replace(/['"\s]/g, "").split(",")[0] ?? "";
}

/** 선택 영역의 font-family 값에서 드롭다운에 표시할 글꼴 이름을 찾는다. */
export function fontLabelFromValue(value: string | undefined | null): string {
  if (!value) return DEFAULT_FONT_LABEL;
  const target = normalizeFamily(value);
  const match = FONT_FAMILIES.find((font) => normalizeFamily(font.value) === target);
  return match ? match.label : value.split(",")[0].replace(/['"]/g, "").trim();
}

/** PPT 크기 콤보의 프리셋 단계(px). A↑/A↓와 Ctrl+Shift+>/<가 이 단계를 따른다. */
export const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];

export const DEFAULT_FONT_SIZE = 18;
export const MIN_FONT_SIZE = FONT_SIZE_PRESETS[0];
export const MAX_FONT_SIZE = FONT_SIZE_PRESETS[FONT_SIZE_PRESETS.length - 1];

/** PPT의 글꼴 크기 크게/작게: 현재 값에서 프리셋 단계로 한 칸 이동. */
export function stepFontSize(current: number, direction: "up" | "down"): number {
  if (direction === "up") {
    const next = FONT_SIZE_PRESETS.find((size) => size > current);
    return next ?? MAX_FONT_SIZE;
  }
  const smaller = FONT_SIZE_PRESETS.filter((size) => size < current);
  return smaller.length > 0 ? smaller[smaller.length - 1] : MIN_FONT_SIZE;
}

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(size)));
}

/** "18px" → 18. 값이 없거나 파싱 불가면 기본 크기. */
export function parseFontSizePx(value: string | undefined | null): number {
  if (!value) return DEFAULT_FONT_SIZE;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : DEFAULT_FONT_SIZE;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16)
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0")).join("")}`;
}

/** ratio(0~1)만큼 흰색과 혼합 — PPT의 "더 밝게". */
export function tintHex(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex([
    rgb[0] + (255 - rgb[0]) * ratio,
    rgb[1] + (255 - rgb[1]) * ratio,
    rgb[2] + (255 - rgb[2]) * ratio
  ]);
}

/** ratio(0~1)만큼 검정과 혼합 — PPT의 "더 어둡게". */
export function shadeHex(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex([rgb[0] * (1 - ratio), rgb[1] * (1 - ratio), rgb[2] * (1 - ratio)]);
}

/** PPT Office 테마의 기본 색 10개 (흰색, 검정, 회색 계열 2, 강조색 6). */
export const THEME_BASE_COLORS = [
  "#ffffff",
  "#000000",
  "#e7e6e6",
  "#44546a",
  "#4472c4",
  "#ed7d31",
  "#a5a5a5",
  "#ffc000",
  "#5b9bd5",
  "#70ad47"
];

/** PPT와 동일한 규칙으로 기본 색의 명암 변형 5단계를 만든다. */
export function themeColorVariants(base: string): string[] {
  if (base.toLowerCase() === "#ffffff") return [0.05, 0.15, 0.25, 0.35, 0.5].map((ratio) => shadeHex(base, ratio));
  if (base.toLowerCase() === "#000000") return [0.5, 0.35, 0.25, 0.15, 0.05].map((ratio) => tintHex(base, ratio));
  return [
    tintHex(base, 0.8),
    tintHex(base, 0.6),
    tintHex(base, 0.4),
    shadeHex(base, 0.25),
    shadeHex(base, 0.5)
  ];
}

/** PPT 표준 색 10개. */
export const STANDARD_COLORS = [
  "#c00000",
  "#ff0000",
  "#ffc000",
  "#ffff00",
  "#92d050",
  "#00b050",
  "#00b0f0",
  "#0070c0",
  "#002060",
  "#7030a0"
];

/** PPT 텍스트 형광펜 색 15개. */
export const HIGHLIGHT_COLORS = [
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#ff00ff",
  "#0000ff",
  "#ff0000",
  "#000080",
  "#008080",
  "#008000",
  "#800080",
  "#800000",
  "#808000",
  "#808080",
  "#c0c0c0",
  "#000000"
];

export const DEFAULT_TEXT_COLOR = "#ff0000";
export const DEFAULT_HIGHLIGHT_COLOR = "#ffff00";

/** PPT 줄 간격 드롭다운 값. */
export const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5", "3"];

export const MAX_RECENT_COLORS = 10;

const RECENT_COLORS_STORAGE_KEY = "pt-editor-recent-colors-v1";

export function loadRecentColors(kind: "text" | "highlight"): string[] {
  try {
    const raw = window.localStorage.getItem(`${RECENT_COLORS_STORAGE_KEY}-${kind}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_COLORS);
  } catch {
    return [];
  }
}

export function saveRecentColors(kind: "text" | "highlight", colors: string[]) {
  try {
    window.localStorage.setItem(`${RECENT_COLORS_STORAGE_KEY}-${kind}`, JSON.stringify(colors.slice(0, MAX_RECENT_COLORS)));
  } catch {
    // localStorage 접근 불가(사생활 보호 모드 등)여도 편집 기능은 계속 동작해야 한다.
  }
}

export function pushRecentColor(colors: string[], color: string): string[] {
  return [color, ...colors.filter((item) => item !== color)].slice(0, MAX_RECENT_COLORS);
}

const richTextPrefix = "__PT_RICH_TEXT_V1__";

export function isRichText(value: string) {
  return value.startsWith(richTextPrefix);
}

export function encodeRichText(html: string) {
  return `${richTextPrefix}${html}`;
}

export function richTextHtml(value: string) {
  if (isRichText(value)) return value.slice(richTextPrefix.length);
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** 두 콘텐츠를 병합한다. 어느 한쪽이 리치 텍스트면 HTML 블록 단위로 합쳐서
 *  접두사가 본문 중간에 섞여 저장되는 것을 막는다. */
export function mergeRichText(previous: string, appended: string): string {
  if (!previous) return appended;
  if (!appended) return previous;
  if (isRichText(previous) || isRichText(appended)) {
    return encodeRichText(`${richTextHtml(previous)}${richTextHtml(appended)}`);
  }
  return `${previous}\n\n${appended}`;
}

/** Text used by search, exports, and duration calculations. */
export function richTextPlain(value: string) {
  const html = isRichText(value) ? value.slice(richTextPrefix.length) : value;
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n");
}

import * as XLSX from "xlsx";
import type { Project, ScriptPage } from "./types";

export function flattenPages(project: Project) {
  return project.sections.flatMap((section) =>
    section.pages.map((page, pageIndex) => ({
      section,
      page,
      pageNumber: pageIndex + 1
    }))
  );
}

/** A page flagged as a memo. Absent flag = regular note. */
export function isMemoPage(page: ScriptPage): boolean {
  return page.isMemo === true;
}

/**
 * Global 1-based page numbers for every non-memo page, in document order.
 * Memo pages are skipped and never appear in the map. Use this everywhere a
 * page number is shown so the tree, editor and exports stay consistent.
 */
export function pageNumbers(project: Project): Map<string, number> {
  const numbers = new Map<string, number>();
  let counter = 0;
  project.sections.forEach((section) => {
    section.pages.forEach((page) => {
      if (isMemoPage(page)) return;
      counter += 1;
      numbers.set(page.id, counter);
    });
  });
  return numbers;
}

/**
 * Number of real notes in a project. Memo pages are documented as excluded
 * from page numbers, counts and time estimates, so they never count here.
 * Use this (not `flattenPages(project).length`) anywhere a "N개 노트" style
 * count is shown.
 */
export function countNotes(project: Project): number {
  return flattenPages(project).reduce(
    (count, item) => (isMemoPage(item.page) ? count : count + 1),
    0
  );
}

export function estimateSeconds(project: Project) {
  const chars = flattenPages(project).reduce(
    (sum, item) => (isMemoPage(item.page) ? sum : sum + item.page.script.length),
    0
  );
  // Memo-only or empty projects have no non-memo script, so no time is shown.
  // The 40s floor only applies once there is real (non-memo) content.
  if (chars === 0) return 0;
  return Math.max(40, Math.round(chars / 4.6));
}

export function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "오늘";
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ExportScope = "all" | "notes" | "memos";

/**
 * Page ids matching an export scope: "notes" keeps only non-memo pages,
 * "memos" only memo pages, "all" every page. Feed the result into
 * makeMarkdown / exportXlsx / makePrintHtml.
 */
export function scopePageIds(project: Project, scope: ExportScope): Set<string> {
  const ids = new Set<string>();
  project.sections.forEach((section) => {
    section.pages.forEach((page) => {
      if (scope === "notes" && isMemoPage(page)) return;
      if (scope === "memos" && !isMemoPage(page)) return;
      ids.add(page.id);
    });
  });
  return ids;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Self-contained print HTML for a project (used for the "PDF" export via the
 * browser's print-to-PDF). Memo pages are labelled [메모] and excluded from
 * page numbering, matching the rest of the app.
 */
export function makePrintHtml(project: Project, selectedPageIds: Set<string>): string {
  const numbers = pageNumbers(project);
  const nl = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");
  const blocks: string[] = [];
  project.sections.forEach((section) => {
    const pages = section.pages.filter((page) => selectedPageIds.has(page.id));
    if (!pages.length) return;
    if (section.title.trim()) blocks.push(`<h2>${escapeHtml(section.title)}</h2>`);
    pages.forEach((page) => {
      const label = isMemoPage(page) ? "[메모]" : `P.${numbers.get(page.id)}`;
      const memo = page.memo.trim() ? `<blockquote>메모: ${nl(page.memo.trim())}</blockquote>` : "";
      blocks.push(
        `<section class="print-page"><div class="pg-label">${escapeHtml(label)}</div>` +
          `<h3>${escapeHtml(page.title || "제목 없음")}</h3>` +
          `<p>${nl(page.script.trim() || "원고 없음")}</p>${memo}</section>`
      );
    });
  });
  const site = project.siteName.trim() ? `<p class="site">${escapeHtml(project.siteName)}</p>` : "";
  const styles =
    "*{box-sizing:border-box}body{font-family:'Malgun Gothic',sans-serif;color:#1a1a1a;margin:32px;line-height:1.6}" +
    "h1{font-size:24px;margin:0 0 4px}.site{color:#666;margin:0 0 24px}" +
    "h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}" +
    ".print-page{margin:0 0 20px;page-break-inside:avoid}.pg-label{font-size:12px;color:#888;font-weight:600}" +
    "h3{font-size:16px;margin:2px 0 6px}p{margin:0;white-space:normal}" +
    "blockquote{margin:8px 0 0;padding:6px 12px;border-left:3px solid #ccc;color:#555;background:#f7f7f7}" +
    "@media print{body{margin:12mm}}";
  return (
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(project.name)}</title><style>${styles}</style></head>` +
    `<body><h1>${escapeHtml(project.name)}</h1>${site}${blocks.join("")}</body></html>`
  );
}

export function makeMarkdown(project: Project, selectedPageIds: Set<string>) {
  const lines = [`# ${project.name}`, "", `사업지: ${project.siteName}`, ""];
  // Global page numbers (memo pages excluded, matching the tree/editor).
  const numbers = pageNumbers(project);
  project.sections.forEach((section) => {
    const pages = section.pages.filter((page) => selectedPageIds.has(page.id));
    if (!pages.length) return;
    if (section.title.trim()) lines.push(`## ${section.title}`, "");
    pages.forEach((page) => {
      const heading = isMemoPage(page) ? `### [메모] ${page.title}` : `### P.${numbers.get(page.id)} ${page.title}`;
      lines.push(heading, "", page.script.trim() || "_원고 없음_", "");
      if (page.memo.trim()) lines.push(`> 메모: ${page.memo.trim()}`, "");
    });
  });
  return lines.join("\n");
}

export function exportXlsx(project: Project, selectedPageIds: Set<string>) {
  const rows: Array<Record<string, string | number>> = [];
  const numbers = pageNumbers(project);
  project.sections.forEach((section) => {
    section.pages.forEach((page) => {
      if (!selectedPageIds.has(page.id)) return;
      rows.push({
        Section: section.title,
        Page: isMemoPage(page) ? "메모" : (numbers.get(page.id) ?? ""),
        Title: page.title,
        Script: page.script,
        Memo: page.memo
      });
    });
  });
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Scripts");
  XLSX.writeFile(book, `${project.name}.xlsx`);
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function pageWord(page: ScriptPage) {
  return page.title.trim() || "제목 없는 노트";
}

/** Direct children of a parent folder, ordered by their `order` field (stable for ties). */
export function projectChildren(projects: Project[], parentId: Project["parentId"]) {
  return projects.filter((project) => project.parentId === parentId).sort((a, b) => a.order - b.order);
}

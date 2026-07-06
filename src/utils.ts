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

export function estimateSeconds(project: Project) {
  const chars = flattenPages(project).reduce((sum, item) => sum + item.page.script.length, 0);
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

export function makeMarkdown(project: Project, selectedPageIds: Set<string>) {
  const lines = [`# ${project.name}`, "", `사업지: ${project.siteName}`, ""];
  project.sections.forEach((section) => {
    const pages = section.pages.filter((page) => selectedPageIds.has(page.id));
    if (!pages.length) return;
    lines.push(`## ${section.title}`, "");
    pages.forEach((page, index) => {
      lines.push(`### P.${index + 1} ${page.title}`, "", page.script.trim() || "_원고 없음_", "");
      if (page.memo.trim()) lines.push(`> 메모: ${page.memo.trim()}`, "");
    });
  });
  return lines.join("\n");
}

export function exportXlsx(project: Project, selectedPageIds: Set<string>) {
  const rows: Array<Record<string, string | number>> = [];
  let number = 1;
  project.sections.forEach((section) => {
    section.pages.forEach((page) => {
      if (!selectedPageIds.has(page.id)) return;
      rows.push({
        Section: section.title,
        Page: number,
        Title: page.title,
        Script: page.script,
        Memo: page.memo
      });
      number += 1;
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
  return page.title.trim() || "제목 없는 페이지";
}

/** Direct children of a parent folder, ordered by their `order` field (stable for ties). */
export function projectChildren(projects: Project[], parentId: Project["parentId"]) {
  return projects.filter((project) => project.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** All descendant ids of a folder — used to block dropping a folder into its own subtree. */
export function descendantProjectIds(projects: Project[], rootId: Project["id"]) {
  const result = new Set<string>();
  const walk = (parentId: Project["id"]) => {
    for (const project of projects) {
      if (project.parentId === parentId && !result.has(project.id)) {
        result.add(project.id);
        walk(project.id);
      }
    }
  };
  walk(rootId);
  return result;
}

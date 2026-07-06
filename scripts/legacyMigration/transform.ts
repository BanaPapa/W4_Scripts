export interface LegacyCut {
  id: string;
  subject: string;
  designNotes: string;
  planningNotes: string;
  text: string;
}

export interface LegacyPart {
  id: string;
  title: string;
  items: LegacyCut[];
}

export interface LegacyNotepadPanel {
  content: string;
  width: number;
}

export interface LegacyScriptContent {
  parts: LegacyPart[];
  notepadContent: LegacyNotepadPanel[];
}

export interface LegacyFileSystemEntry {
  id: string;
  name: string;
  type: "script" | "folder";
}

export interface MigratedScriptPage {
  id: string;
  title: string;
  script: string;
  memo: string;
  referenceLinks: string[];
  tags: string[];
}

export interface MigratedScriptSection {
  id: string;
  title: string;
  collapsed: boolean;
  pages: MigratedScriptPage[];
}

export interface MigratedProject {
  name: string;
  siteName: string;
  labelColor: "green" | "blue" | "orange" | "violet";
  favorite: boolean;
  updatedAt: string;
  projectMemos: { qa: string; caution: string; feedback: string };
  sections: MigratedScriptSection[];
}

const GENERIC_NAME_PATTERN = /^스크립트\s*\d+$/;

export function isGenericName(name: string): boolean {
  return GENERIC_NAME_PATTERN.test(name.trim());
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractNameFromCuts(parts: LegacyPart[]): string | null {
  for (const part of parts) {
    for (const cut of part.items) {
      const candidate = (cut.subject || cut.text || "").trim();
      if (candidate) return truncate(candidate, 30);
    }
  }
  return null;
}

export function extractNameFromNotepad(panels: LegacyNotepadPanel[]): string | null {
  for (const panel of panels) {
    const plain = stripHtml(panel.content || "");
    const firstLine = plain.split("\n").find((line) => line.trim().length > 0);
    if (firstLine) return truncate(firstLine, 30);
  }
  return null;
}

export function mergeCutMemo(planningNotes: string, designNotes: string): string {
  const parts: string[] = [];
  if (planningNotes.trim()) parts.push(`[기획] ${planningNotes.trim()}`);
  if (designNotes.trim()) parts.push(`[디자인] ${designNotes.trim()}`);
  return parts.join("\n");
}

export function parseTimestampFromId(id: string, fallback: string): string {
  const match = id.match(/^script-(\d+)-/);
  if (!match) return fallback;
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) return fallback;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

export function transformLegacyProject(
  entry: LegacyFileSystemEntry,
  content: LegacyScriptContent,
  mode: "script" | "notepad",
  nowIso: string
): MigratedProject {
  const updatedAt = parseTimestampFromId(entry.id, nowIso);

  let name = entry.name;
  if (isGenericName(entry.name)) {
    const extracted =
      mode === "notepad" ? extractNameFromNotepad(content.notepadContent) : extractNameFromCuts(content.parts);
    if (extracted) name = extracted;
  }

  const sections: MigratedScriptSection[] =
    mode === "notepad"
      ? [
          {
            id: `${entry.id}-memo-section`,
            title: "메모",
            collapsed: false,
            pages: [
              {
                id: `${entry.id}-memo-page`,
                title: name,
                script: content.notepadContent
                  .map((panel) => stripHtml(panel.content || ""))
                  .filter((text) => text.length > 0)
                  .join("\n\n---\n\n"),
                memo: "",
                referenceLinks: [],
                tags: []
              }
            ]
          }
        ]
      : content.parts.map((part) => ({
          id: part.id,
          title: part.title,
          collapsed: false,
          pages: part.items.map((cut, index) => ({
            id: cut.id,
            title: cut.subject || `컷 ${index + 1}`,
            script: cut.text || "",
            memo: mergeCutMemo(cut.planningNotes || "", cut.designNotes || ""),
            referenceLinks: [],
            tags: []
          }))
        }));

  return {
    name,
    siteName: name,
    labelColor: "blue",
    favorite: false,
    updatedAt,
    projectMemos: { qa: "", caution: "", feedback: "" },
    sections
  };
}

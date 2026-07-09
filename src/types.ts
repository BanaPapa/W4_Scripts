import type { Id } from "../convex/_generated/dataModel";

export type View = "home" | "project" | "memos" | "settings" | "trash";

export type LabelColor = "green" | "blue" | "orange" | "violet";

export type MemoKind = "qa" | "caution" | "feedback";

export type ProjectKind = "script" | "category" | "memo";

export interface ScriptPage {
  id: string;
  title: string;
  script: string;
  memo: string;
  referenceLinks: string[];
  tags: string[];
  // Whether this page is a memo (excluded from page numbering and export counts).
  // Optional: absent means a regular note.
  isMemo?: boolean;
}

export interface ScriptSection {
  id: string;
  title: string;
  collapsed: boolean;
  pages: ScriptPage[];
}

export interface Project {
  id: Id<"projects">;
  name: string;
  siteName: string;
  labelColor: LabelColor;
  emoji: string;
  favorite: boolean;
  updatedAt: string;
  sections: ScriptSection[];
  projectMemos: Record<MemoKind, string>;
  deletedAt?: string;
  kind: ProjectKind;
  parentId?: Id<"projects">;
  order: number;
  memoText: string;
}

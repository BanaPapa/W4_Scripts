import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const scriptPageValidator = v.object({
  id: v.string(),
  title: v.string(),
  script: v.string(),
  memo: v.string(),
  referenceLinks: v.array(v.string()),
  tags: v.array(v.string()),
  // A page flagged as a memo is excluded from page numbering / duration / export
  // counts and rendered with a memo badge. Optional so existing docs (no flag)
  // stay valid and are treated as regular notes.
  isMemo: v.optional(v.boolean()),
  // 갑지(타이틀 페이지): 페이지 번호 매기기에서 제외된다. Optional so existing
  // docs (no flag) stay valid and are treated as regular notes.
  isCover: v.optional(v.boolean())
});

export const scriptSectionValidator = v.object({
  id: v.string(),
  title: v.string(),
  collapsed: v.boolean(),
  pages: v.array(scriptPageValidator)
});

export const labelColorValidator = v.union(
  v.literal("green"),
  v.literal("blue"),
  v.literal("orange"),
  v.literal("violet")
);

export const projectKindValidator = v.union(
  v.literal("script"),
  v.literal("category"),
  v.literal("memo")
);

export const projectMemosValidator = v.object({
  qa: v.string(),
  caution: v.string(),
  feedback: v.string()
});

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    siteName: v.string(),
    labelColor: labelColorValidator,
    emoji: v.optional(v.string()),
    favorite: v.boolean(),
    updatedAt: v.string(),
    projectMemos: projectMemosValidator,
    sections: v.array(scriptSectionValidator),
    deletedAt: v.optional(v.string()),
    // Folder classification. Optional so existing/seed docs (implicit "script") stay valid.
    kind: v.optional(projectKindValidator),
    // Parent category folder id. Absent = top level.
    parentId: v.optional(v.id("projects")),
    // Sort order among siblings sharing the same parent.
    order: v.optional(v.number()),
    // Body text for memo-kind folders.
    memoText: v.optional(v.string())
  })
    // 활성/휴지통 문서를 인덱스에서 바로 거른다. 인덱스 없이 collect() 후 JS로
    // 필터하면 구독 쿼리가 재실행될 때마다(모든 patch마다) 테이블 전체 — 모든
    // 프로젝트의 원고 본문 — 를 읽어 Database I/O가 폭증한다.
    .index("by_deletedAt", ["deletedAt"])
});

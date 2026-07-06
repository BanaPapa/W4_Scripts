import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const scriptPageValidator = v.object({
  id: v.string(),
  title: v.string(),
  script: v.string(),
  memo: v.string(),
  referenceLinks: v.array(v.string()),
  tags: v.array(v.string())
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
});

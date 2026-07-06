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
    deletedAt: v.optional(v.string())
  })
});

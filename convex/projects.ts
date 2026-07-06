import { mutation, MutationCtx, query } from "./_generated/server";
import { v } from "convex/values";
import { seedProjects } from "../src/data";
import {
  labelColorValidator,
  projectKindValidator,
  projectMemosValidator,
  scriptSectionValidator
} from "./schema";

async function insertSeedProjects(ctx: MutationCtx) {
  for (const project of seedProjects) {
    const { id: _id, ...rest } = project;
    await ctx.db.insert("projects", rest);
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("projects").collect();
    return all.filter((project) => project.deletedAt === undefined);
  }
});

export const listTrash = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("projects").collect();
    return all.filter((project) => project.deletedAt !== undefined);
  }
});

export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").first();
    if (existing) return;
    await insertSeedProjects(ctx);
  }
});

export const create = mutation({
  args: {
    name: v.string(),
    siteName: v.string(),
    labelColor: labelColorValidator,
    kind: v.optional(projectKindValidator),
    parentId: v.optional(v.id("projects"))
  },
  handler: async (ctx, args) => {
    const kind = args.kind ?? "script";
    const all = await ctx.db.query("projects").collect();
    const siblings = all.filter(
      (project) => project.deletedAt === undefined && project.parentId === args.parentId
    );
    const order = siblings.reduce((max, project) => Math.max(max, project.order ?? 0), 0) + 1;

    const sections =
      kind === "script"
        ? [
            {
              id: crypto.randomUUID(),
              title: "Introduction",
              collapsed: false,
              pages: [
                {
                  id: crypto.randomUUID(),
                  title: "오프닝",
                  script: "새 발표 원고를 작성합니다.",
                  memo: "",
                  referenceLinks: [],
                  tags: []
                }
              ]
            }
          ]
        : [];

    return await ctx.db.insert("projects", {
      name: args.name,
      siteName: args.siteName,
      labelColor: args.labelColor,
      favorite: false,
      updatedAt: new Date().toISOString(),
      projectMemos: { qa: "", caution: "", feedback: "" },
      sections,
      kind,
      parentId: args.parentId,
      order,
      memoText: ""
    });
  }
});

// Move a project to a new parent and renumber the destination parent's children
// (0..n-1) so ordering stays stable even when older docs share order values.
export const reorderProjects = mutation({
  args: {
    movedId: v.id("projects"),
    parentId: v.optional(v.id("projects")),
    orderedIds: v.array(v.id("projects"))
  },
  handler: async (ctx, { movedId, parentId, orderedIds }) => {
    await ctx.db.patch(movedId, { parentId, updatedAt: new Date().toISOString() });
    for (let index = 0; index < orderedIds.length; index += 1) {
      await ctx.db.patch(orderedIds[index], { order: index });
    }
  }
});

export const updateMemoText = mutation({
  args: { id: v.id("projects"), memoText: v.string() },
  handler: async (ctx, { id, memoText }) => {
    await ctx.db.patch(id, { memoText, updatedAt: new Date().toISOString() });
  }
});

export const updateMeta = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
    siteName: v.string(),
    labelColor: labelColorValidator
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: new Date().toISOString() });
  }
});

export const toggleFavorite = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const project = await ctx.db.get(id);
    if (!project) return;
    await ctx.db.patch(id, { favorite: !project.favorite, updatedAt: new Date().toISOString() });
  }
});

export const patch = mutation({
  args: {
    id: v.id("projects"),
    sections: v.array(scriptSectionValidator),
    projectMemos: projectMemosValidator
  },
  handler: async (ctx, { id, sections, projectMemos }) => {
    await ctx.db.patch(id, { sections, projectMemos, updatedAt: new Date().toISOString() });
  }
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { deletedAt: new Date().toISOString() });
    const all = await ctx.db.query("projects").collect();
    const hasActive = all.some((project) => project.deletedAt === undefined);
    if (!hasActive) await insertSeedProjects(ctx);
  }
});

export const restore = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { deletedAt: undefined });
  }
});

export const permanentlyDelete = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  }
});

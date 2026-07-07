import { mutation, MutationCtx, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { seedProjects } from "../src/data";
import { labelColorValidator, projectMemosValidator, scriptSectionValidator } from "./schema";

type SectionDoc = Doc<"projects">["sections"][number];

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
    labelColor: labelColorValidator
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("projects").collect();
    const active = all.filter((project) => project.deletedAt === undefined);
    const order = active.reduce((max, project) => Math.max(max, project.order ?? 0), 0) + 1;

    // A project starts with one untitled section (rendered without a divider)
    // holding a single empty note.
    const sections = [
      {
        id: crypto.randomUUID(),
        title: "",
        collapsed: false,
        pages: [
          {
            id: crypto.randomUUID(),
            title: "새 노트",
            script: "",
            memo: "",
            referenceLinks: [],
            tags: []
          }
        ]
      }
    ];

    return await ctx.db.insert("projects", {
      name: args.name,
      siteName: args.siteName,
      labelColor: args.labelColor,
      favorite: false,
      updatedAt: new Date().toISOString(),
      projectMemos: { qa: "", caution: "", feedback: "" },
      sections,
      kind: "script",
      order
    });
  }
});

// Renumber top-level projects (0..n-1) after a drag reorder.
export const reorderProjects = mutation({
  args: { orderedIds: v.array(v.id("projects")) },
  handler: async (ctx, { orderedIds }) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await ctx.db.patch(orderedIds[index], { order: index });
    }
  }
});

// One-time migration for the old 3-kind hierarchy (category/script/memo folders,
// arbitrarily nested). Flattens everything into top-level projects whose sections
// act as dividers between notes:
//   - a category folder becomes a project; each descendant script folder turns
//     into a section (its pages become the notes), and each memo folder turns
//     into a plain note whose body is the old memo text
//   - a root memo folder becomes a project with a single note
// Idempotent: does nothing once no legacy kinds/parent links remain.
export const flattenHierarchy = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("projects").collect();
    const isLegacy = (doc: Doc<"projects">) =>
      (doc.kind ?? "script") !== "script" || doc.parentId !== undefined;
    if (!all.some(isLegacy)) return;

    const active = all.filter((doc) => doc.deletedAt === undefined);
    const activeIds = new Set(active.map((doc) => doc._id));
    const childrenOf = (parentId: Id<"projects">) =>
      active
        .filter((doc) => doc.parentId === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const freshPages = (pages: SectionDoc["pages"]) =>
      pages.map((page) => ({ ...page, id: crypto.randomUUID() }));
    const memoNote = (doc: Doc<"projects">): SectionDoc["pages"][number] => ({
      id: crypto.randomUUID(),
      title: doc.name,
      script: doc.memoText ?? "",
      memo: "",
      referenceLinks: [],
      tags: []
    });
    const untitledSection = (pages: SectionDoc["pages"]): SectionDoc => ({
      id: crypto.randomUUID(),
      title: "",
      collapsed: false,
      pages
    });

    const absorbed: Id<"projects">[] = [];
    function collectSections(parentId: Id<"projects">): SectionDoc[] {
      const sections: SectionDoc[] = [];
      let looseNotes: SectionDoc["pages"] = [];
      const flushLoose = () => {
        if (looseNotes.length) {
          sections.push(untitledSection(looseNotes));
          looseNotes = [];
        }
      };
      for (const child of childrenOf(parentId)) {
        absorbed.push(child._id);
        const kind = child.kind ?? "script";
        if (kind === "memo") {
          looseNotes.push(memoNote(child));
          continue;
        }
        // A script folder holding a single page was being used as a note:
        // carry it over as one, titled by the folder name the user saw.
        if (kind === "script" && child.sections.length <= 1 && (child.sections[0]?.pages.length ?? 0) <= 1) {
          const singlePage = child.sections[0]?.pages[0];
          looseNotes.push(
            singlePage
              ? { ...singlePage, id: crypto.randomUUID(), title: child.name }
              : { id: crypto.randomUUID(), title: child.name, script: "", memo: "", referenceLinks: [], tags: [] }
          );
          continue;
        }
        flushLoose();
        if (kind === "category") {
          sections.push(...collectSections(child._id));
        } else if (child.sections.length <= 1) {
          sections.push({
            id: crypto.randomUUID(),
            title: child.name,
            collapsed: false,
            pages: freshPages(child.sections[0]?.pages ?? [])
          });
        } else {
          for (const section of child.sections) {
            sections.push({
              id: crypto.randomUUID(),
              title: `${child.name} · ${section.title}`,
              collapsed: section.collapsed,
              pages: freshPages(section.pages)
            });
          }
        }
      }
      flushLoose();
      return sections;
    }

    const roots = active
      .filter((doc) => doc.parentId === undefined || !activeIds.has(doc.parentId))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];
      const kind = root.kind ?? "script";
      const base = { kind: "script" as const, parentId: undefined, order: index };
      if (kind === "category") {
        await ctx.db.patch(root._id, {
          ...base,
          sections: [...root.sections, ...collectSections(root._id)]
        });
      } else if (kind === "memo") {
        await ctx.db.patch(root._id, { ...base, sections: [untitledSection([memoNote(root)])] });
      } else if (isLegacy(root)) {
        await ctx.db.patch(root._id, base);
      } else if ((root.order ?? 0) !== index) {
        // Keep the visible order stable: legacy roots get renumbered, so
        // untouched projects must be renumbered with them.
        await ctx.db.patch(root._id, { order: index });
      }
    }
    for (const id of absorbed) {
      await ctx.db.delete(id);
    }

    // Trashed legacy docs: convert their shape too so restoring them works
    // in the flat model.
    for (const doc of all.filter((item) => item.deletedAt !== undefined && isLegacy(item))) {
      const kind = doc.kind ?? "script";
      await ctx.db.patch(doc._id, {
        kind: "script",
        parentId: undefined,
        ...(kind === "memo" ? { sections: [untitledSection([memoNote(doc)])] } : {})
      });
    }
  }
});

export const updateMeta = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
    siteName: v.string(),
    labelColor: labelColorValidator,
    emoji: v.optional(v.string())
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
    const target = await ctx.db.get(id);
    if (!target) return;
    await ctx.db.patch(id, { deletedAt: new Date().toISOString() });
    const all = await ctx.db.query("projects").collect();
    const hasActive = all.some((project) => project.deletedAt === undefined && project._id !== id);
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

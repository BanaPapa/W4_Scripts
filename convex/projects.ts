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

// list/listTrash는 구독형이라 문서가 바뀔 때마다 재실행된다. 반드시 인덱스로
// 필요한 문서만 읽어야 한다 — full collect()는 실행마다 전체 원고를 다 읽는다.
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .collect();
  }
});

export const listTrash = query({
  args: {},
  handler: async (ctx) => {
    // deletedAt이 undefined인 문서는 인덱스에서 모든 문자열보다 앞에 정렬되므로
    // gt("")가 휴지통 문서(ISO 문자열)만 읽는다.
    return await ctx.db
      .query("projects")
      .withIndex("by_deletedAt", (q) => q.gt("deletedAt", ""))
      .collect();
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
    const active = await ctx.db
      .query("projects")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .collect();
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

// Deep-clones a project (fresh ids for every section/page) so the copy is
// fully independent from the source. Appended to the end of the active list.
export const duplicate = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const source = await ctx.db.get(id);
    if (!source) return null;
    const active = await ctx.db
      .query("projects")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .collect();
    const order = active.reduce((max, project) => Math.max(max, project.order ?? 0), 0) + 1;
    const sections = source.sections.map((section) => ({
      ...section,
      id: crypto.randomUUID(),
      pages: section.pages.map((page) => ({ ...page, id: crypto.randomUUID() }))
    }));

    return await ctx.db.insert("projects", {
      name: `${source.name} 복사본`,
      siteName: source.siteName,
      labelColor: source.labelColor,
      emoji: source.emoji,
      favorite: false,
      updatedAt: new Date().toISOString(),
      projectMemos: source.projectMemos,
      sections,
      kind: source.kind,
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

// Sections and projectMemos are patched independently: callers send only the
// field they actually changed. This avoids a stale-cache overwrite where a
// section edit would resend (and revert) a just-saved projectMemos value, and
// vice versa. At least one field is expected.
export const patch = mutation({
  args: {
    id: v.id("projects"),
    sections: v.optional(v.array(scriptSectionValidator)),
    projectMemos: v.optional(projectMemosValidator)
  },
  handler: async (ctx, { id, sections, projectMemos }) => {
    if (sections === undefined && projectMemos === undefined) return;
    const patchData: Partial<Doc<"projects">> = { updatedAt: new Date().toISOString() };
    if (sections !== undefined) patchData.sections = sections;
    if (projectMemos !== undefined) patchData.projectMemos = projectMemos;
    await ctx.db.patch(id, patchData);
  }
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const target = await ctx.db.get(id);
    if (!target) return;
    await ctx.db.patch(id, { deletedAt: new Date().toISOString() });
    const remainingActive = await ctx.db
      .query("projects")
      .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
      .first();
    if (!remainingActive) await insertSeedProjects(ctx);
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

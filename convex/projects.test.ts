import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function sampleProject(overrides: { name?: string } = {}) {
  return {
    name: overrides.name ?? "테스트 프로젝트",
    siteName: "테스트 사이트",
    labelColor: "blue" as const
  };
}

describe("projects trash", () => {
  test("remove soft-deletes: project disappears from list and appears in listTrash", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());
    await t.mutation(api.projects.create, sampleProject({ name: "다른 프로젝트" }));

    await t.mutation(api.projects.remove, { id });

    const active = await t.query(api.projects.list, {});
    const trash = await t.query(api.projects.listTrash, {});

    expect(active.some((p) => p._id === id)).toBe(false);
    expect(trash.some((p) => p._id === id)).toBe(true);
  });

  test("restore moves a project back out of trash", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());
    await t.mutation(api.projects.remove, { id });

    await t.mutation(api.projects.restore, { id });

    const active = await t.query(api.projects.list, {});
    const trash = await t.query(api.projects.listTrash, {});

    expect(active.some((p) => p._id === id)).toBe(true);
    expect(trash.some((p) => p._id === id)).toBe(false);
  });

  test("permanentlyDelete removes the project for good", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());
    await t.mutation(api.projects.remove, { id });

    await t.mutation(api.projects.permanentlyDelete, { id });

    const trash = await t.query(api.projects.listTrash, {});
    expect(trash.some((p) => p._id === id)).toBe(false);
  });

  test("remove reseeds default projects when no active projects remain", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());

    await t.mutation(api.projects.remove, { id });

    const active = await t.query(api.projects.list, {});
    expect(active.length).toBeGreaterThan(0);
  });
});

describe("projects flat model", () => {
  test("create makes a top-level project with one untitled section and one note", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());

    const list = await t.query(api.projects.list, {});
    const project = list.find((item) => item._id === id);

    expect(project?.kind).toBe("script");
    expect(project?.parentId).toBeUndefined();
    expect(project?.sections).toHaveLength(1);
    expect(project?.sections[0].title).toBe("");
    expect(project?.sections[0].pages).toHaveLength(1);
  });

  test("reorderProjects renumbers projects to match the given order", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.projects.create, sampleProject({ name: "A" }));
    const second = await t.mutation(api.projects.create, sampleProject({ name: "B" }));

    await t.mutation(api.projects.reorderProjects, { orderedIds: [second, first] });

    const list = await t.query(api.projects.list, {});
    expect(list.find((item) => item._id === second)?.order).toBe(0);
    expect(list.find((item) => item._id === first)?.order).toBe(1);
  });
});

describe("projects patch (independent fields)", () => {
  test("patching sections only preserves projectMemos", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());

    // Save some project memos first.
    await t.mutation(api.projects.patch, {
      id,
      projectMemos: { qa: "질문", caution: "주의", feedback: "피드백" }
    });

    // A later section-only edit must not revert the saved memos.
    const project = (await t.query(api.projects.list, {})).find((p) => p._id === id)!;
    const nextSections = [
      ...project.sections,
      { id: crypto.randomUUID(), title: "추가 구획", collapsed: false, pages: [] }
    ];
    await t.mutation(api.projects.patch, { id, sections: nextSections });

    const after = (await t.query(api.projects.list, {})).find((p) => p._id === id)!;
    expect(after.sections).toHaveLength(2);
    expect(after.projectMemos).toEqual({ qa: "질문", caution: "주의", feedback: "피드백" });
  });

  test("patching projectMemos only preserves sections", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());
    const before = (await t.query(api.projects.list, {})).find((p) => p._id === id)!;

    await t.mutation(api.projects.patch, {
      id,
      projectMemos: { qa: "A", caution: "B", feedback: "C" }
    });

    const after = (await t.query(api.projects.list, {})).find((p) => p._id === id)!;
    expect(after.sections).toEqual(before.sections);
    expect(after.projectMemos).toEqual({ qa: "A", caution: "B", feedback: "C" });
  });
});

describe("flattenHierarchy migration", () => {
  const baseDoc = {
    siteName: "",
    labelColor: "green" as const,
    favorite: false,
    updatedAt: new Date().toISOString(),
    projectMemos: { qa: "", caution: "", feedback: "" }
  };

  function scriptSections(pageTitles: string[]) {
    return [
      {
        id: crypto.randomUUID(),
        title: "Introduction",
        collapsed: false,
        pages: pageTitles.map((title) => ({
          id: crypto.randomUUID(),
          title,
          script: `${title} 원고`,
          memo: "",
          referenceLinks: [],
          tags: []
        }))
      }
    ];
  }

  test("category tree collapses into one project: scripts become sections, memos become notes", async () => {
    const t = convexTest(schema, modules);
    const categoryId = await t.run(async (ctx) => {
      const category = await ctx.db.insert("projects", {
        ...baseDoc,
        name: "프로젝트 A",
        sections: [],
        kind: "category",
        order: 0
      });
      await ctx.db.insert("projects", {
        ...baseDoc,
        name: "대본 1",
        sections: scriptSections(["오프닝", "마무리"]),
        kind: "script",
        parentId: category,
        order: 1
      });
      await ctx.db.insert("projects", {
        ...baseDoc,
        name: "메모 1",
        sections: [],
        kind: "memo",
        parentId: category,
        order: 2,
        memoText: "메모 내용"
      });
      return category;
    });

    await t.mutation(api.projects.flattenHierarchy, {});

    const list = await t.query(api.projects.list, {});
    expect(list).toHaveLength(1);
    const project = list[0];
    expect(project._id).toBe(categoryId);
    expect(project.kind).toBe("script");
    expect(project.parentId).toBeUndefined();
    expect(project.sections).toHaveLength(2);
    expect(project.sections[0].title).toBe("대본 1");
    expect(project.sections[0].pages.map((page) => page.title)).toEqual(["오프닝", "마무리"]);
    expect(project.sections[1].title).toBe("");
    expect(project.sections[1].pages).toHaveLength(1);
    expect(project.sections[1].pages[0].title).toBe("메모 1");
    expect(project.sections[1].pages[0].script).toBe("메모 내용");
  });

  test("single-page script folders under a category turn into plain notes", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const category = await ctx.db.insert("projects", {
        ...baseDoc,
        name: "프로젝트 B",
        sections: [],
        kind: "category",
        order: 0
      });
      await ctx.db.insert("projects", {
        ...baseDoc,
        name: "노트 A",
        sections: scriptSections(["원래 페이지 제목"]),
        kind: "script",
        parentId: category,
        order: 1
      });
      await ctx.db.insert("projects", {
        ...baseDoc,
        name: "메모 B",
        sections: [],
        kind: "memo",
        parentId: category,
        order: 2,
        memoText: "메모 본문"
      });
    });

    await t.mutation(api.projects.flattenHierarchy, {});

    const list = await t.query(api.projects.list, {});
    expect(list).toHaveLength(1);
    const project = list[0];
    // Both children collapse into one untitled section of loose notes.
    expect(project.sections).toHaveLength(1);
    expect(project.sections[0].title).toBe("");
    expect(project.sections[0].pages.map((page) => page.title)).toEqual(["노트 A", "메모 B"]);
    expect(project.sections[0].pages[0].script).toBe("원래 페이지 제목 원고");
    expect(project.sections[0].pages[1].script).toBe("메모 본문");
  });

  test("a root memo folder becomes a project holding a single note", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("projects", {
        ...baseDoc,
        name: "회의 메모",
        sections: [],
        kind: "memo",
        order: 0,
        memoText: "회의록 본문"
      });
    });

    await t.mutation(api.projects.flattenHierarchy, {});

    const list = await t.query(api.projects.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("script");
    expect(list[0].name).toBe("회의 메모");
    expect(list[0].sections[0].pages[0].title).toBe("회의 메모");
    expect(list[0].sections[0].pages[0].script).toBe("회의록 본문");
  });

  test("already-flat data is left untouched", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, sampleProject());
    const before = await t.query(api.projects.list, {});

    await t.mutation(api.projects.flattenHierarchy, {});

    const after = await t.query(api.projects.list, {});
    expect(after).toEqual(before);
    expect(after.find((item) => item._id === id)).toBeDefined();
  });
});

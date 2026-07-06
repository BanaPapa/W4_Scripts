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

describe("projects hierarchy", () => {
  test("create stores kind/parentId and gives siblings an incrementing order", async () => {
    const t = convexTest(schema, modules);
    const categoryId = await t.mutation(api.projects.create, {
      name: "분류",
      siteName: "",
      labelColor: "blue",
      kind: "category"
    });
    const firstChild = await t.mutation(api.projects.create, {
      name: "A",
      siteName: "",
      labelColor: "green",
      kind: "script",
      parentId: categoryId
    });
    const secondChild = await t.mutation(api.projects.create, {
      name: "B",
      siteName: "",
      labelColor: "green",
      kind: "memo",
      parentId: categoryId
    });

    const list = await t.query(api.projects.list, {});
    const a = list.find((project) => project._id === firstChild);
    const b = list.find((project) => project._id === secondChild);

    expect(a?.parentId).toBe(categoryId);
    expect(a?.kind).toBe("script");
    expect(b?.kind).toBe("memo");
    expect(b?.order ?? 0).toBeGreaterThan(a?.order ?? 0);
  });

  test("reorderProjects reparents into a category and back out to the root", async () => {
    const t = convexTest(schema, modules);
    const categoryId = await t.mutation(api.projects.create, {
      name: "분류",
      siteName: "",
      labelColor: "blue",
      kind: "category"
    });
    const projectId = await t.mutation(api.projects.create, sampleProject({ name: "이동 대상" }));

    await t.mutation(api.projects.reorderProjects, {
      movedId: projectId,
      parentId: categoryId,
      orderedIds: [projectId]
    });
    let list = await t.query(api.projects.list, {});
    expect(list.find((project) => project._id === projectId)?.parentId).toBe(categoryId);
    expect(list.find((project) => project._id === projectId)?.order).toBe(0);

    await t.mutation(api.projects.reorderProjects, { movedId: projectId, orderedIds: [projectId] });
    list = await t.query(api.projects.list, {});
    expect(list.find((project) => project._id === projectId)?.parentId).toBeUndefined();
  });

  test("updateMemoText persists the memo body", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.projects.create, {
      name: "메모",
      siteName: "",
      labelColor: "green",
      kind: "memo"
    });

    await t.mutation(api.projects.updateMemoText, { id, memoText: "회의록 내용" });

    const list = await t.query(api.projects.list, {});
    expect(list.find((project) => project._id === id)?.memoText).toBe("회의록 내용");
  });
});

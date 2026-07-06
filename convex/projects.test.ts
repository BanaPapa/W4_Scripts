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

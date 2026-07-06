# 삭제 안전장치 + 휴지통 + 구 데이터 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 삭제 시 확인 다이얼로그를 추가하고, 삭제된 프로젝트를 복원 가능한 휴지통에 보관하며, 구 대본 작성 앱(Firebase Realtime Database)에 남아있는 18개 대본을 새 앱의 프로젝트 형태로 마이그레이션한다.

**Architecture:** Convex `projects` 테이블에 소프트 삭제용 `deletedAt` 필드를 추가하고, 기존 `remove` mutation을 하드 삭제에서 소프트 삭제로 바꾼 뒤 `restore`/`permanentlyDelete`/`listTrash`를 추가한다. React UI(`src/App.tsx`)에 삭제 확인창과 휴지통 화면을 추가한다. 구 데이터 마이그레이션은 이미 받아둔 Firebase 스냅샷(JSON)을 순수 변환 함수로 새 스키마 모양으로 바꾸고, 사람이 요약을 검토한 뒤 `npx convex import`로 1회성 반영한다.

**Tech Stack:** React 19, Convex, Vite, TypeScript, Vitest + convex-test(신규 도입), tsx(마이그레이션 스크립트 실행용)

**전제 조건:** 아래 파일이 이미 저장소에 준비되어 있다 (이번 세션에서 구 앱의 라이브 Firebase Realtime Database `script-helper-9166e`에서 읽어와 복사해둠):
- `scripts/legacyMigration/snapshot/fileSystem.json`
- `scripts/legacyMigration/snapshot/scripts.json`
- `scripts/legacyMigration/snapshot/viewModes.json`

관련 설계 문서: `docs/superpowers/specs/2026-07-06-delete-safety-and-legacy-import-design.md`

---

## Task 1: 테스트 도구 설치 (Vitest + convex-test)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 의존성 설치**

Run:
```bash
npm install -D vitest convex-test @edge-runtime/vm tsx
```

- [ ] **Step 2: Vitest 설정 파일 생성**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } }
  }
});
```

- [ ] **Step 3: package.json에 테스트 스크립트 추가**

`package.json`의 `"scripts"` 블록을 다음과 같이 수정한다 (기존 `dev`/`build`/`preview`는 유지, 아래 두 줄을 추가):

```json
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173",
    "test": "vitest run",
    "migrate:legacy": "tsx scripts/legacyMigration/run.ts"
  },
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest and convex-test tooling"
```

---

## Task 2: Convex 휴지통 백엔드 (소프트 삭제 / 복원 / 완전삭제)

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/projects.ts`
- Create: `convex/projects.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `convex/projects.test.ts`:
```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run convex/projects.test.ts`
Expected: FAIL — `api.projects.listTrash`/`restore`/`permanentlyDelete`가 아직 없어서 에러가 난다 (예: "is not a function" 또는 undefined 참조 에러).

- [ ] **Step 3: 스키마에 `deletedAt` 필드 추가**

`convex/schema.ts:33-43`을 다음으로 교체:
```ts
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
```

- [ ] **Step 4: `list`/`remove` 수정 및 `listTrash`/`restore`/`permanentlyDelete` 추가**

`convex/projects.ts:13-18`의 기존 `list`를 다음으로 교체:
```ts
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
```

`convex/projects.ts:96-103`의 기존 `remove`를 다음으로 교체:
```ts
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
```

- [ ] **Step 5: Convex 타입 재생성**

Run: `npx convex codegen`
Expected: `convex/_generated/api.d.ts`와 `api.js`가 갱신되어 `api.projects.listTrash`, `api.projects.restore`, `api.projects.permanentlyDelete`가 인식된다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run convex/projects.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/projects.ts convex/projects.test.ts convex/_generated
git commit -m "feat: soft-delete projects into a trash bin (restore/permanentlyDelete)"
```

---

## Task 3: 삭제 확인 다이얼로그 (UI)

**Files:**
- Modify: `src/App.tsx:647-651`

- [ ] **Step 1: `deleteProject`에 확인창 추가**

`src/App.tsx:647-651`의 기존 코드:
```tsx
  function deleteProject(projectId: Id<"projects">) {
    const next = projects.filter((project) => project.id !== projectId);
    onDeleteProject(projectId);
    if (activeProjectId === projectId) onSelectProject(next[0]?.id ?? "");
  }
```

다음으로 교체:
```tsx
  function deleteProject(projectId: Id<"projects">) {
    const target = projects.find((project) => project.id === projectId);
    const message = `'${target?.name ?? "이 프로젝트"}' 프로젝트를 삭제하시겠습니까? 삭제된 프로젝트는 휴지통으로 이동합니다.`;
    if (!window.confirm(message)) return;
    const next = projects.filter((project) => project.id !== projectId);
    onDeleteProject(projectId);
    if (activeProjectId === projectId) onSelectProject(next[0]?.id ?? "");
  }
```

- [ ] **Step 2: 수동 확인**

Run: `npm run dev`
1. 프로젝트 카드의 삭제(휴지통 아이콘) 버튼 클릭 → 확인창이 뜨는지 확인
2. 취소 클릭 → 프로젝트가 그대로 남아있는지 확인
3. 확인 클릭 → 프로젝트가 목록에서 사라지는지 확인

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: confirm before deleting a project"
```

---

## Task 4: 휴지통 화면 (복원 / 완전 삭제)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: `View` 타입과 `Project` 타입 수정**

`src/types.ts:3`의 기존 코드:
```ts
export type View = "home" | "project" | "export" | "memos" | "settings";
```
다음으로 교체:
```ts
export type View = "home" | "project" | "export" | "memos" | "settings" | "trash";
```

`src/types.ts:25-34`의 `Project` 인터페이스에 `deletedAt` 필드를 추가 (마지막 줄 `projectMemos` 다음에 삽입):
```ts
export interface Project {
  id: Id<"projects">;
  name: string;
  siteName: string;
  labelColor: LabelColor;
  favorite: boolean;
  updatedAt: string;
  sections: ScriptSection[];
  projectMemos: Record<MemoKind, string>;
  deletedAt?: string;
}
```

- [ ] **Step 2: App 컴포넌트에 휴지통 쿼리/뮤테이션과 매핑 헬퍼 추가**

`src/App.tsx:177-199`의 기존 코드:
```tsx
export default function App() {
  const projectsQuery = useQuery(api.projects.list);
  const createProjectMutation = useMutation(api.projects.create);
  const updateMetaMutation = useMutation(api.projects.updateMeta);
  const toggleFavoriteMutation = useMutation(api.projects.toggleFavorite);
  const removeProjectMutation = useMutation(api.projects.remove);
  const patchProjectMutation = useMutation(api.projects.patch);
  const seedIfEmptyMutation = useMutation(api.projects.seedIfEmpty);

  const projects: Project[] = useMemo(
    () =>
      (projectsQuery ?? []).map((doc) => ({
        id: doc._id,
        name: doc.name,
        siteName: doc.siteName,
        labelColor: doc.labelColor,
        favorite: doc.favorite,
        updatedAt: doc.updatedAt,
        projectMemos: doc.projectMemos,
        sections: doc.sections
      })),
    [projectsQuery]
  );
```

다음으로 교체:
```tsx
function mapProjectDoc(doc: {
  _id: Id<"projects">;
  name: string;
  siteName: string;
  labelColor: LabelColor;
  favorite: boolean;
  updatedAt: string;
  projectMemos: Project["projectMemos"];
  sections: Project["sections"];
  deletedAt?: string;
}): Project {
  return {
    id: doc._id,
    name: doc.name,
    siteName: doc.siteName,
    labelColor: doc.labelColor,
    favorite: doc.favorite,
    updatedAt: doc.updatedAt,
    projectMemos: doc.projectMemos,
    sections: doc.sections,
    deletedAt: doc.deletedAt
  };
}

export default function App() {
  const projectsQuery = useQuery(api.projects.list);
  const trashQuery = useQuery(api.projects.listTrash);
  const createProjectMutation = useMutation(api.projects.create);
  const updateMetaMutation = useMutation(api.projects.updateMeta);
  const toggleFavoriteMutation = useMutation(api.projects.toggleFavorite);
  const removeProjectMutation = useMutation(api.projects.remove);
  const restoreProjectMutation = useMutation(api.projects.restore);
  const permanentlyDeleteProjectMutation = useMutation(api.projects.permanentlyDelete);
  const patchProjectMutation = useMutation(api.projects.patch);
  const seedIfEmptyMutation = useMutation(api.projects.seedIfEmpty);

  const projects: Project[] = useMemo(() => (projectsQuery ?? []).map(mapProjectDoc), [projectsQuery]);
  const trashedProjects: Project[] = useMemo(() => (trashQuery ?? []).map(mapProjectDoc), [trashQuery]);
```

Note: `mapProjectDoc`는 `App` 함수 바깥(모듈 최상위)에 정의한다.

- [ ] **Step 3: 삭제/복원 핸들러 추가**

`src/App.tsx:290-292`의 기존 코드:
```tsx
  function handleDeleteProject(id: Id<"projects">) {
    removeProjectMutation({ id });
  }
```
다음으로 교체:
```tsx
  function handleDeleteProject(id: Id<"projects">) {
    removeProjectMutation({ id });
  }

  function handleRestoreProject(id: Id<"projects">) {
    restoreProjectMutation({ id });
  }

  function handlePermanentlyDeleteProject(id: Id<"projects">) {
    permanentlyDeleteProjectMutation({ id });
  }
```

- [ ] **Step 4: `Home`에 휴지통 진입 버튼 추가**

`src/App.tsx`에서 `Home` 컴포넌트의 props 타입(569-587행 부근)에 `onOpenTrash: () => void;`를 추가하고 구조분해에도 추가한다. 기존:
```tsx
function Home({
  projects,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onToggleFavorite,
  onOpenProject,
  onSelectProject,
  activeProjectId
}: {
  projects: Project[];
  onCreateProject: (input: { name: string; siteName: string; labelColor: LabelColor }) => Promise<Id<"projects">>;
  onEditProject: (id: Id<"projects">, input: { name: string; siteName: string; labelColor: LabelColor }) => void;
  onDeleteProject: (id: Id<"projects">) => void;
  onToggleFavorite: (id: Id<"projects">) => void;
  onOpenProject: (projectId: Id<"projects">) => void;
  onSelectProject: (projectId: Id<"projects"> | "") => void;
  activeProjectId: Id<"projects"> | "";
}) {
```
다음으로 교체:
```tsx
function Home({
  projects,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onToggleFavorite,
  onOpenProject,
  onSelectProject,
  activeProjectId,
  onOpenTrash
}: {
  projects: Project[];
  onCreateProject: (input: { name: string; siteName: string; labelColor: LabelColor }) => Promise<Id<"projects">>;
  onEditProject: (id: Id<"projects">, input: { name: string; siteName: string; labelColor: LabelColor }) => void;
  onDeleteProject: (id: Id<"projects">) => void;
  onToggleFavorite: (id: Id<"projects">) => void;
  onOpenProject: (projectId: Id<"projects">) => void;
  onSelectProject: (projectId: Id<"projects"> | "") => void;
  activeProjectId: Id<"projects"> | "";
  onOpenTrash: () => void;
}) {
```

Home의 헤더 액션 영역(`header-actions` div, 665-673행 부근)의 기존 코드:
```tsx
        <div className="header-actions">
          <button className="btn" onClick={() => openEdit(projects.find((p) => p.id === activeProjectId) ?? projects[0])}>
            <Pencil size={16} />
            이름 변경
          </button>
          <button className="btn primary" onClick={openCreate}>
            <Plus size={16} />새 폴더
          </button>
        </div>
```
다음으로 교체:
```tsx
        <div className="header-actions">
          <button className="btn" onClick={onOpenTrash}>
            <Trash2 size={16} />
            휴지통
          </button>
          <button className="btn" onClick={() => openEdit(projects.find((p) => p.id === activeProjectId) ?? projects[0])}>
            <Pencil size={16} />
            이름 변경
          </button>
          <button className="btn primary" onClick={openCreate}>
            <Plus size={16} />새 폴더
          </button>
        </div>
```

- [ ] **Step 5: `App`의 렌더링에 `Home` prop 전달 및 `trash` 뷰 추가**

`src/App.tsx:404-434`(main-area) 기존 코드:
```tsx
      <main className="main-area">
        {view === "home" && (
          <Home
            projects={projects}
            onCreateProject={handleCreateProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onToggleFavorite={handleToggleFavorite}
            onOpenProject={openProject}
            onSelectProject={setActiveProjectId}
            activeProjectId={activeProjectId}
          />
        )}
        {view === "project" && (
          <ProjectDetail
            project={activeProject}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
            onNavigate={setView}
          />
        )}
        {view === "export" && <ExportView project={activeProject} onNavigate={setView} />}
        {view === "memos" && (
          <MemosView
            project={activeProject}
            onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
          />
        )}
        {view === "settings" && <SettingsView settings={uiSettings} onSettingsChange={setUISettings} />}
      </main>
```
다음으로 교체:
```tsx
      <main className="main-area">
        {view === "home" && (
          <Home
            projects={projects}
            onCreateProject={handleCreateProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onToggleFavorite={handleToggleFavorite}
            onOpenProject={openProject}
            onSelectProject={setActiveProjectId}
            activeProjectId={activeProjectId}
            onOpenTrash={() => setView("trash")}
          />
        )}
        {view === "project" && (
          <ProjectDetail
            project={activeProject}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
            onNavigate={setView}
          />
        )}
        {view === "export" && <ExportView project={activeProject} onNavigate={setView} />}
        {view === "memos" && (
          <MemosView
            project={activeProject}
            onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
          />
        )}
        {view === "settings" && <SettingsView settings={uiSettings} onSettingsChange={setUISettings} />}
        {view === "trash" && (
          <TrashView
            projects={trashedProjects}
            onRestore={handleRestoreProject}
            onPermanentlyDelete={handlePermanentlyDeleteProject}
            onBack={() => setView("home")}
          />
        )}
      </main>
```

- [ ] **Step 6: `TrashView` 컴포넌트 추가**

`src/App.tsx`에서 `Home` 함수 정의가 끝나는 지점(위 Step 4에서 수정한 `header-actions` 아래, `Home` 함수의 닫는 `}` 다음) 바로 뒤에 새 컴포넌트를 추가한다:
```tsx
function TrashView({
  projects,
  onRestore,
  onPermanentlyDelete,
  onBack
}: {
  projects: Project[];
  onRestore: (id: Id<"projects">) => void;
  onPermanentlyDelete: (id: Id<"projects">) => void;
  onBack: () => void;
}) {
  function permanentlyDelete(project: Project) {
    const message = `'${project.name}' 프로젝트를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`;
    if (!window.confirm(message)) return;
    onPermanentlyDelete(project.id);
  }

  return (
    <section className="screen-wrap">
      <header className="page-header">
        <div>
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={16} />
            홈으로
          </button>
          <h1>휴지통</h1>
          <p className="subcopy">삭제된 프로젝트를 복원하거나 완전히 삭제할 수 있습니다.</p>
        </div>
      </header>

      {projects.length === 0 ? (
        <p>휴지통이 비어 있습니다.</p>
      ) : (
        <div className="folder-list list">
          {projects.map((project) => (
            <article key={project.id} className="folder-card">
              <span className="folder-main">
                <span className={`label-strip ${project.labelColor}`} />
                <span className="folder-title">{project.name}</span>
                <span className="folder-site">{project.siteName}</span>
              </span>
              <div className="folder-tools">
                <button className="btn" onClick={() => onRestore(project.id)}>
                  복원
                </button>
                <button className="icon-btn danger" onClick={() => permanentlyDelete(project)} aria-label="완전 삭제">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: 수동 확인**

Run: `npm run dev`
1. 홈 화면에서 "휴지통" 버튼 클릭 → 휴지통 화면으로 이동
2. (Task 3에서) 삭제한 프로젝트가 휴지통에 보이는지 확인
3. "복원" 클릭 → 홈 목록에 다시 나타나는지 확인
4. 다시 삭제 → 휴지통에서 "완전 삭제" 클릭 → 확인창 → 확인 후 휴지통에서도 사라지는지 확인

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/types.ts
git commit -m "feat: add trash view with restore and permanent delete"
```

---

## Task 5: 구 데이터 변환 순수 함수

**Files:**
- Create: `scripts/legacyMigration/transform.ts`
- Create: `scripts/legacyMigration/transform.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `scripts/legacyMigration/transform.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  isGenericName,
  stripHtml,
  extractNameFromCuts,
  extractNameFromNotepad,
  mergeCutMemo,
  parseTimestampFromId,
  transformLegacyProject
} from "./transform";

describe("isGenericName", () => {
  test("matches auto-generated placeholder names", () => {
    expect(isGenericName("스크립트 9879")).toBe(true);
    expect(isGenericName("  스크립트 123  ")).toBe(true);
  });
  test("does not match real names", () => {
    expect(isGenericName("진주 평거센트럴")).toBe(false);
  });
});

describe("stripHtml", () => {
  test("converts divs and br tags to newlines and removes remaining tags", () => {
    const html = "<div>첫줄</div><div>둘째줄<br>셋째줄</div>";
    expect(stripHtml(html)).toBe("첫줄\n둘째줄\n셋째줄");
  });
  test("decodes common entities", () => {
    expect(stripHtml("A&nbsp;B&amp;C")).toBe("A B&C");
  });
});

describe("extractNameFromCuts", () => {
  test("returns the first non-empty cut subject", () => {
    const parts = [
      { id: "p1", title: "파트1", items: [{ id: "c1", subject: "", designNotes: "", planningNotes: "", text: "" }] },
      { id: "p2", title: "파트2", items: [{ id: "c2", subject: "오프닝 인사", designNotes: "", planningNotes: "", text: "" }] }
    ];
    expect(extractNameFromCuts(parts)).toBe("오프닝 인사");
  });
  test("returns null when nothing is found", () => {
    const parts = [{ id: "p1", title: "파트1", items: [] }];
    expect(extractNameFromCuts(parts)).toBeNull();
  });
});

describe("extractNameFromNotepad", () => {
  test("returns the first non-empty stripped line", () => {
    const panels = [{ width: 50, content: "<div><br></div><div>진주 부동산시장 소개</div>" }];
    expect(extractNameFromNotepad(panels)).toBe("진주 부동산시장 소개");
  });
});

describe("mergeCutMemo", () => {
  test("combines both notes with labels", () => {
    expect(mergeCutMemo("기획메모", "디자인메모")).toBe("[기획] 기획메모\n[디자인] 디자인메모");
  });
  test("omits missing notes", () => {
    expect(mergeCutMemo("", "디자인메모")).toBe("[디자인] 디자인메모");
    expect(mergeCutMemo("", "")).toBe("");
  });
});

describe("parseTimestampFromId", () => {
  test("parses the embedded millisecond timestamp", () => {
    expect(parseTimestampFromId("script-1758515737518-05233893693709879", "fallback")).toBe(
      new Date(1758515737518).toISOString()
    );
  });
  test("falls back when the id does not match", () => {
    expect(parseTimestampFromId("not-a-script-id", "fallback-value")).toBe("fallback-value");
  });
});

describe("transformLegacyProject", () => {
  test("maps script mode parts/cuts into sections/pages", () => {
    const entry = { id: "script-1-abc", name: "스크립트 0001", type: "script" as const };
    const content = {
      parts: [
        {
          id: "part-1",
          title: "오프닝",
          items: [
            { id: "cut-1", subject: "인사", designNotes: "느긋하게", planningNotes: "밝은 톤", text: "안녕하세요" }
          ]
        }
      ],
      notepadContent: []
    };
    const result = transformLegacyProject(entry, content, "script", "2026-01-01T00:00:00.000Z");
    expect(result.name).toBe("인사");
    expect(result.sections).toEqual([
      {
        id: "part-1",
        title: "오프닝",
        collapsed: false,
        pages: [
          {
            id: "cut-1",
            title: "인사",
            script: "안녕하세요",
            memo: "[기획] 밝은 톤\n[디자인] 느긋하게",
            referenceLinks: [],
            tags: []
          }
        ]
      }
    ]);
  });

  test("keeps a meaningful original name and merges notepad panels for notepad mode", () => {
    const entry = { id: "script-2-xyz", name: "진주 평거센트럴 메모", type: "script" as const };
    const content = {
      parts: [],
      notepadContent: [
        { width: 50, content: "<div>첫 패널</div>" },
        { width: 50, content: "<div>둘째 패널</div>" }
      ]
    };
    const result = transformLegacyProject(entry, content, "notepad", "2026-01-01T00:00:00.000Z");
    expect(result.name).toBe("진주 평거센트럴 메모");
    expect(result.sections[0].pages[0].script).toBe("첫 패널\n\n---\n\n둘째 패널");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/legacyMigration/transform.test.ts`
Expected: FAIL — `./transform` 모듈이 없어서 import 에러

- [ ] **Step 3: 변환 함수 구현**

Create `scripts/legacyMigration/transform.ts`:
```ts
export interface LegacyCut {
  id: string;
  subject: string;
  designNotes: string;
  planningNotes: string;
  text: string;
}

export interface LegacyPart {
  id: string;
  title: string;
  items: LegacyCut[];
}

export interface LegacyNotepadPanel {
  content: string;
  width: number;
}

export interface LegacyScriptContent {
  parts: LegacyPart[];
  notepadContent: LegacyNotepadPanel[];
}

export interface LegacyFileSystemEntry {
  id: string;
  name: string;
  type: "script" | "folder";
}

export interface MigratedScriptPage {
  id: string;
  title: string;
  script: string;
  memo: string;
  referenceLinks: string[];
  tags: string[];
}

export interface MigratedScriptSection {
  id: string;
  title: string;
  collapsed: boolean;
  pages: MigratedScriptPage[];
}

export interface MigratedProject {
  name: string;
  siteName: string;
  labelColor: "green" | "blue" | "orange" | "violet";
  favorite: boolean;
  updatedAt: string;
  projectMemos: { qa: string; caution: string; feedback: string };
  sections: MigratedScriptSection[];
}

const GENERIC_NAME_PATTERN = /^스크립트\s*\d+$/;

export function isGenericName(name: string): boolean {
  return GENERIC_NAME_PATTERN.test(name.trim());
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractNameFromCuts(parts: LegacyPart[]): string | null {
  for (const part of parts) {
    for (const cut of part.items) {
      const candidate = (cut.subject || cut.text || "").trim();
      if (candidate) return truncate(candidate, 30);
    }
  }
  return null;
}

export function extractNameFromNotepad(panels: LegacyNotepadPanel[]): string | null {
  for (const panel of panels) {
    const plain = stripHtml(panel.content || "");
    const firstLine = plain.split("\n").find((line) => line.trim().length > 0);
    if (firstLine) return truncate(firstLine, 30);
  }
  return null;
}

export function mergeCutMemo(planningNotes: string, designNotes: string): string {
  const parts: string[] = [];
  if (planningNotes.trim()) parts.push(`[기획] ${planningNotes.trim()}`);
  if (designNotes.trim()) parts.push(`[디자인] ${designNotes.trim()}`);
  return parts.join("\n");
}

export function parseTimestampFromId(id: string, fallback: string): string {
  const match = id.match(/^script-(\d+)-/);
  if (!match) return fallback;
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) return fallback;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

export function transformLegacyProject(
  entry: LegacyFileSystemEntry,
  content: LegacyScriptContent,
  mode: "script" | "notepad",
  nowIso: string
): MigratedProject {
  const updatedAt = parseTimestampFromId(entry.id, nowIso);

  let name = entry.name;
  if (isGenericName(entry.name)) {
    const extracted =
      mode === "notepad" ? extractNameFromNotepad(content.notepadContent) : extractNameFromCuts(content.parts);
    if (extracted) name = extracted;
  }

  const sections: MigratedScriptSection[] =
    mode === "notepad"
      ? [
          {
            id: `${entry.id}-memo-section`,
            title: "메모",
            collapsed: false,
            pages: [
              {
                id: `${entry.id}-memo-page`,
                title: name,
                script: content.notepadContent
                  .map((panel) => stripHtml(panel.content || ""))
                  .filter((text) => text.length > 0)
                  .join("\n\n---\n\n"),
                memo: "",
                referenceLinks: [],
                tags: []
              }
            ]
          }
        ]
      : content.parts.map((part) => ({
          id: part.id,
          title: part.title,
          collapsed: false,
          pages: part.items.map((cut, index) => ({
            id: cut.id,
            title: cut.subject || `컷 ${index + 1}`,
            script: cut.text || "",
            memo: mergeCutMemo(cut.planningNotes || "", cut.designNotes || ""),
            referenceLinks: [],
            tags: []
          }))
        }));

  return {
    name,
    siteName: name,
    labelColor: "blue",
    favorite: false,
    updatedAt,
    projectMemos: { qa: "", caution: "", feedback: "" },
    sections
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/legacyMigration/transform.test.ts`
Expected: PASS (전체 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add scripts/legacyMigration/transform.ts scripts/legacyMigration/transform.test.ts
git commit -m "feat: add pure transform functions for legacy data migration"
```

---

## Task 6: 마이그레이션 실행 스크립트 및 실제 반영

**Files:**
- Create: `scripts/legacyMigration/run.ts`

- [ ] **Step 1: 실행 스크립트 작성**

Create `scripts/legacyMigration/run.ts`:
```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformLegacyProject, LegacyFileSystemEntry, LegacyScriptContent } from "./transform";

const here = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(here, "snapshot");
const outputDir = join(here, "output");

const fileSystem: LegacyFileSystemEntry[] = JSON.parse(
  readFileSync(join(snapshotDir, "fileSystem.json"), "utf-8")
);
const scripts: Record<string, LegacyScriptContent> = JSON.parse(
  readFileSync(join(snapshotDir, "scripts.json"), "utf-8")
);
const viewModes: Record<string, "script" | "notepad"> = JSON.parse(
  readFileSync(join(snapshotDir, "viewModes.json"), "utf-8")
);

const nowIso = new Date().toISOString();
const projects = fileSystem
  .filter((entry) => entry.type === "script")
  .map((entry) => {
    const content = scripts[entry.id] ?? { parts: [], notepadContent: [] };
    const mode = viewModes[entry.id] ?? "script";
    return transformLegacyProject(entry, content, mode, nowIso);
  });

mkdirSync(outputDir, { recursive: true });

const jsonl = projects.map((project) => JSON.stringify(project)).join("\n");
writeFileSync(join(outputDir, "projects.jsonl"), jsonl, "utf-8");

const summaryLines = projects.map((project, index) => {
  const pageCount = project.sections.reduce((sum, section) => sum + section.pages.length, 0);
  const scriptChars = project.sections.reduce(
    (sum, section) => sum + section.pages.reduce((s, page) => s + page.script.length, 0),
    0
  );
  return `${index + 1}. ${project.name} | sections=${project.sections.length} pages=${pageCount} scriptChars=${scriptChars}`;
});
const summary = summaryLines.join("\n");
writeFileSync(join(outputDir, "summary.txt"), summary, "utf-8");

console.log(summary);
console.log(`\n총 ${projects.length}개 프로젝트를 scripts/legacyMigration/output/projects.jsonl 에 저장했습니다.`);
```

- [ ] **Step 2: 변환 실행 및 요약 검토**

Run: `npm run migrate:legacy`
Expected: 콘솔에 18줄의 요약(이름 | sections=N pages=N scriptChars=N)이 출력되고, `scripts/legacyMigration/output/projects.jsonl`(18줄)과 `summary.txt`가 생성된다.

이 요약을 사람이 직접 읽고 이름/섹션수/페이지수가 원본과 대략 맞아떨어지는지 확인한다 (자동 테스트 대상 아님 — 1회성 데이터 검수).

- [ ] **Step 3: Convex import 플래그 확인 (실제 DB에 반영하기 전 필수)**

Run: `npx convex import --help`
Expected: 출력에서 기존 테이블 데이터를 보존한 채 추가하는 옵션(예: `--append`)과, 테이블을 통째로 교체/삭제하는 옵션이 무엇인지 확인한다. **`--replace`나 테이블을 비우는 옵션은 절대 사용하지 않는다** — 기존 활성 프로젝트가 날아간다.

- [ ] **Step 4: 실제 DB에 반영**

Run (위 Step 3에서 확인한 "추가" 전용 플래그를 사용, 아래는 현재 Convex CLI 기준 예상 커맨드):
```bash
npx convex import --table projects --append scripts/legacyMigration/output/projects.jsonl
```
Expected: 18개 문서가 `projects` 테이블에 추가되었다는 메시지.

- [ ] **Step 5: 앱에서 확인**

Run: `npm run dev`
1. 홈 화면에 프로젝트가 기존 것 + 18개(총 개수 확인)로 늘어났는지 확인
2. "진주 평거센트럴"과 "진주 평거센트럴 메모"로 이름 지어진 두 프로젝트를 열어서 원본 내용(예: "저흰 아직도 가격에 대한 상방이 열려있다고 봅니다...")과 일치하는지 샘플 확인
3. 이름이 자동 추출된 프로젝트 몇 개를 열어 내용이 비어있지 않은지 확인

- [ ] **Step 6: Commit**

```bash
git add scripts/legacyMigration/run.ts scripts/legacyMigration/output package.json
git commit -m "feat: migrate 18 legacy scripts into the new project format"
```

---

## 테스트 요약

- `convex/projects.test.ts`: 소프트 삭제/복원/완전삭제/재시딩 로직 (convex-test)
- `scripts/legacyMigration/transform.test.ts`: 이름 추출, HTML→텍스트 변환, 메모 결합, 타임스탬프 파싱, 전체 변환 함수 (vitest 순수 함수 테스트)
- 삭제 확인 다이얼로그, 휴지통 화면, 마이그레이션 실제 반영: 수동 확인 (사용자가 "핵심 로직만 자동 테스트, UI는 수동 확인"을 선택함)

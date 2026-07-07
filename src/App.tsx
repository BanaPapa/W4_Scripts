import {
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Folder,
  GripVertical,
  LayoutGrid,
  List,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Plus,
  Printer,
  Search,
  Settings,
  Star,
  Sun,
  Trash2
} from "lucide-react";
import { CSSProperties, DragEvent, Fragment, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { LabelColor, MemoKind, Project, ProjectKind, ScriptPage, ScriptSection, View } from "./types";
import {
  downloadText,
  estimateSeconds,
  exportXlsx,
  flattenPages,
  formatDate,
  formatDuration,
  makeMarkdown,
  pageWord,
  projectChildren
} from "./utils";

/** Sections with an empty title are implicit containers: their notes render
 *  directly under the project without a divider row. */
function isDividerSection(section: ScriptSection) {
  return section.title.trim() !== "";
}

const UI_STORAGE_KEY = "pt-script-manager-ui-v1";

type EmojiCategory = { id: string; label: string; icon: string; list: string[] };

const emojiCategories: EmojiCategory[] = [
  {
    id: "study",
    label: "문서·사무",
    icon: "📁",
    list: [
      "📁", "📂", "🗂️", "🗃️", "📦", "📚", "📖", "📕", "📗", "📘",
      "📙", "📔", "📓", "📒", "📑", "📄", "📃", "📜", "📰", "🗞️",
      "📝", "✏️", "🖊️", "🖋️", "🖍️", "✒️", "🖌️", "📌", "📍", "🔖"
    ]
  },
  {
    id: "smiley",
    label: "표정·사람",
    icon: "😀",
    list: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚"
    ]
  },
  {
    id: "animal",
    label: "동물",
    icon: "🐶",
    list: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"
    ]
  },
  {
    id: "nature",
    label: "자연·날씨",
    icon: "🌿",
    list: [
      "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍",
      "🍃", "🍂", "🍁", "🌾", "🌺", "🌸", "🌼", "🌻", "🌷", "🌹"
    ]
  },
  {
    id: "food",
    label: "음식·음료",
    icon: "🍎",
    list: [
      "🍎", "🍏", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦"
    ]
  },
  {
    id: "activity",
    label: "활동·취미",
    icon: "⚽",
    list: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
      "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "🪁"
    ]
  },
  {
    id: "transport",
    label: "이동수단",
    icon: "🚗",
    list: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
      "🚚", "🚛", "🚜", "🛴", "🚲", "🛵", "🏍️", "🚨", "🚔", "🚍"
    ]
  },
  {
    id: "place",
    label: "건물·장소",
    icon: "🏠",
    list: [
      "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠",
      "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️"
    ]
  },
  {
    id: "heart",
    label: "하트",
    icon: "❤️",
    list: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"
    ]
  }
];

type DragInfo =
  | { type: "section"; sectionId: string }
  | { type: "page"; pageId: string; sectionId: string };

type DropMarker =
  | { type: "section"; sectionId: string; position: "before" | "after" }
  | { type: "page"; pageId: string; position: "before" | "after" }
  | { type: "section-end"; sectionId: string };

interface UISettings {
  theme: "light" | "dark";
  navCollapsed: boolean;
  sidebarWidth: number;
  navFontFamily: string;
  navTextSize: number;
  navTextColor: string;
  categoryFontFamily: string;
  categoryTextSize: number;
  categoryTextColor: string;
  noteTitleFontFamily: string;
  noteTitleTextSize: number;
  noteTitleTextColor: string;
  noteBackgroundColor: string;
  noteContentFontFamily: string;
  noteContentTextSize: number;
  noteContentTextColor: string;
  memoFontFamily: string;
  memoTextSize: number;
  memoTextColor: string;
  memoBackgroundColor: string;
  linkFontFamily: string;
  linkTextSize: number;
  linkTextColor: string;
  tagFontFamily: string;
  tagTextSize: number;
  tagTextColor: string;
}

const defaultUISettings: UISettings = {
  theme: "light",
  navCollapsed: false,
  sidebarWidth: 252,
  navFontFamily: "Pretendard",
  navTextSize: 17,
  navTextColor: "#667085",
  categoryFontFamily: "Pretendard",
  categoryTextSize: 18,
  categoryTextColor: "#667085",
  noteTitleFontFamily: "Pretendard",
  noteTitleTextSize: 17,
  noteTitleTextColor: "#111827",
  noteBackgroundColor: "#ffffff",
  noteContentFontFamily: "Pretendard",
  noteContentTextSize: 23,
  noteContentTextColor: "#111827",
  memoFontFamily: "Pretendard",
  memoTextSize: 17,
  memoTextColor: "#667085",
  memoBackgroundColor: "#f4f5f7",
  linkFontFamily: "Pretendard",
  linkTextSize: 17,
  linkTextColor: "#667085",
  tagFontFamily: "Pretendard",
  tagTextSize: 16,
  tagTextColor: "#667085"
};

const darkStyleDefaults = {
  navTextColor: "#d8dee8",
  categoryTextColor: "#a8b3c2",
  noteTitleTextColor: "#f8fafc",
  noteBackgroundColor: "#171e24",
  noteContentTextColor: "#f8fafc",
  memoTextColor: "#d1d8e0",
  memoBackgroundColor: "#20272e",
  linkTextColor: "#9fb5d4",
  tagTextColor: "#d1d8e0"
};

const memoLabels: Record<MemoKind, string> = {
  qa: "예상 Q&A",
  caution: "주의 사항",
  feedback: "피드백"
};

function uid(prefix: string) {
  if ("randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadUISettings() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return defaultUISettings;
    const parsed = JSON.parse(raw) as Partial<UISettings> & {
      sectionTextSize?: number;
      sectionTextColor?: string;
      noteTextSize?: number;
      noteTextColor?: string;
      pageMemoTextSize?: number;
      pageMemoTextColor?: string;
      pageMemoBackgroundColor?: string;
    };
    return {
      ...defaultUISettings,
      ...parsed,
      navFontFamily: parsed.navFontFamily ?? defaultUISettings.navFontFamily,
      navTextSize: parsed.navTextSize ?? defaultUISettings.navTextSize,
      navTextColor: parsed.navTextColor ?? defaultUISettings.navTextColor,
      categoryFontFamily: parsed.categoryFontFamily ?? defaultUISettings.categoryFontFamily,
      categoryTextSize: parsed.categoryTextSize ?? parsed.sectionTextSize ?? defaultUISettings.categoryTextSize,
      categoryTextColor: parsed.categoryTextColor ?? parsed.sectionTextColor ?? defaultUISettings.categoryTextColor,
      noteTitleFontFamily: parsed.noteTitleFontFamily ?? defaultUISettings.noteTitleFontFamily,
      noteTitleTextSize: parsed.noteTitleTextSize ?? parsed.noteTextSize ?? defaultUISettings.noteTitleTextSize,
      noteTitleTextColor: parsed.noteTitleTextColor ?? parsed.noteTextColor ?? defaultUISettings.noteTitleTextColor,
      noteContentFontFamily: parsed.noteContentFontFamily ?? defaultUISettings.noteContentFontFamily,
      noteContentTextSize: parsed.noteContentTextSize ?? defaultUISettings.noteContentTextSize,
      noteContentTextColor: parsed.noteContentTextColor ?? defaultUISettings.noteContentTextColor,
      memoFontFamily: parsed.memoFontFamily ?? defaultUISettings.memoFontFamily,
      memoTextSize: parsed.memoTextSize ?? parsed.pageMemoTextSize ?? defaultUISettings.memoTextSize,
      memoTextColor: parsed.memoTextColor ?? parsed.pageMemoTextColor ?? defaultUISettings.memoTextColor,
      memoBackgroundColor:
        parsed.memoBackgroundColor ?? parsed.pageMemoBackgroundColor ?? defaultUISettings.memoBackgroundColor,
      linkFontFamily: parsed.linkFontFamily ?? defaultUISettings.linkFontFamily,
      linkTextSize: parsed.linkTextSize ?? defaultUISettings.linkTextSize,
      linkTextColor: parsed.linkTextColor ?? defaultUISettings.linkTextColor,
      tagFontFamily: parsed.tagFontFamily ?? defaultUISettings.tagFontFamily,
      tagTextSize: parsed.tagTextSize ?? defaultUISettings.tagTextSize,
      tagTextColor: parsed.tagTextColor ?? defaultUISettings.tagTextColor
    };
  } catch {
    return defaultUISettings;
  }
}

function mapProjectDoc(doc: {
  _id: Id<"projects">;
  name: string;
  siteName: string;
  labelColor: LabelColor;
  emoji?: string;
  favorite: boolean;
  updatedAt: string;
  projectMemos: Project["projectMemos"];
  sections: Project["sections"];
  deletedAt?: string;
  kind?: ProjectKind;
  parentId?: Id<"projects">;
  order?: number;
  memoText?: string;
}): Project {
  return {
    id: doc._id,
    name: doc.name,
    siteName: doc.siteName,
    labelColor: doc.labelColor,
    emoji: doc.emoji ?? "📁",
    favorite: doc.favorite,
    updatedAt: doc.updatedAt,
    projectMemos: doc.projectMemos,
    sections: doc.sections,
    deletedAt: doc.deletedAt,
    kind: doc.kind ?? "script",
    parentId: doc.parentId,
    order: doc.order ?? 0,
    memoText: doc.memoText ?? ""
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
  // Optimistic updates keep typing responsive: without them every keystroke
  // waits a full server round trip before the controlled input re-renders.
  const patchProjectMutation = useMutation(api.projects.patch).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.projects.list, {});
    if (current === undefined) return;
    localStore.setQuery(
      api.projects.list,
      {},
      current.map((doc) =>
        doc._id === args.id
          ? { ...doc, sections: args.sections, projectMemos: args.projectMemos, updatedAt: new Date().toISOString() }
          : doc
      )
    );
  });
  const reorderProjectsMutation = useMutation(api.projects.reorderProjects);
  const flattenHierarchyMutation = useMutation(api.projects.flattenHierarchy);
  const seedIfEmptyMutation = useMutation(api.projects.seedIfEmpty);

  const projects: Project[] = useMemo(() => (projectsQuery ?? []).map(mapProjectDoc), [projectsQuery]);
  const trashedProjects: Project[] = useMemo(() => (trashQuery ?? []).map(mapProjectDoc), [trashQuery]);

  const [view, setView] = useState<View>("home");
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | "">("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [uiSettings, setUISettings] = useState<UISettings>(loadUISettings);
  const [resizingNav, setResizingNav] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<Id<"projects">>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [autoRenameId, setAutoRenameId] = useState<Id<"projects"> | null>(null);
  const migrationRequested = useRef(false);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    if (projectsQuery && projectsQuery.length === 0) {
      seedIfEmptyMutation({});
    }
  }, [projectsQuery, seedIfEmptyMutation]);

  // Legacy data (category/memo folders, nested parents) is flattened once into
  // the 2-level project → note model.
  useEffect(() => {
    if (migrationRequested.current) return;
    const docs = [...(projectsQuery ?? []), ...(trashQuery ?? [])];
    const needsMigration = docs.some((doc) => (doc.kind ?? "script") !== "script" || doc.parentId !== undefined);
    if (needsMigration) {
      migrationRequested.current = true;
      flattenHierarchyMutation({});
    }
  }, [projectsQuery, trashQuery, flattenHierarchyMutation]);

  useEffect(() => {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    if (!resizingNav) return undefined;
    function onMove(event: globalThis.MouseEvent) {
      setUISettings((current) => ({
        ...current,
        navCollapsed: false,
        sidebarWidth: Math.min(420, Math.max(196, event.clientX))
      }));
    }
    function onUp() {
      setResizingNav(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingNav]);

  useEffect(() => {
    if (!activeProject) return;
    const pages = flattenPages(activeProject);
    if (!pages.some((item) => item.page.id === selectedPageId)) {
      setSelectedPageId(pages[0]?.page.id ?? "");
    }
  }, [activeProject, selectedPageId]);

  function updateProject(projectId: Id<"projects">, updater: (project: Project) => Project) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const next = updater(project);
    patchProjectMutation({ id: projectId, sections: next.sections, projectMemos: next.projectMemos });
  }

  function openProject(projectId: Id<"projects">) {
    const project = projects.find((item) => item.id === projectId);
    setActiveProjectId(projectId);
    setSelectedPageId(project?.sections[0]?.pages[0]?.id ?? "");
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function openSearchResult(projectId: Id<"projects">, pageId: string) {
    const project = projects.find((item) => item.id === projectId);
    if (project) {
      const sections = project.sections.map((section) => ({
        ...section,
        collapsed: section.pages.some((page) => page.id === pageId) ? false : section.collapsed
      }));
      patchProjectMutation({ id: projectId, sections, projectMemos: project.projectMemos });
    }
    setActiveProjectId(projectId);
    setSelectedPageId(pageId);
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function toggleAllExpanded() {
    setExpandedProjectIds((current) => {
      if (current.size > 0) return new Set();
      return new Set(projects.map((project) => project.id));
    });
  }

  function toggleProjectExpanded(projectId: Id<"projects">) {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleTreeSection(projectId: Id<"projects">, sectionId: string) {
    updateProject(projectId, (project) => ({
      ...project,
      sections: project.sections.map((section) =>
        section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section
      )
    }));
  }

  function toggleTheme() {
    setUISettings((current) => {
      const nextTheme = current.theme === "light" ? "dark" : "light";
      return { ...current, theme: nextTheme };
    });
  }

  function handleEditProject(id: Id<"projects">, input: { name: string; siteName: string; labelColor: LabelColor }) {
    updateMetaMutation({ id, ...input });
  }

  function handleRenameProject(id: Id<"projects">, name: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    updateMetaMutation({ id, name, siteName: project.siteName, labelColor: project.labelColor });
  }

  async function submitCreateProject(input: { name: string; siteName: string; labelColor: LabelColor }) {
    const newId = await createProjectMutation(input);
    setCreateOpen(false);
    openProject(newId);
  }

  // The nav "+" skips the modal: the project appears immediately, ready to rename.
  async function quickCreateProject() {
    const newId = await createProjectMutation({ name: "새 프로젝트", siteName: "", labelColor: "green" });
    openProject(newId);
    setAutoRenameId(newId);
  }

  // The big "+" button: append a fresh note to the given project and open it.
  function addNoteToProject(projectId: Id<"projects">) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const page: ScriptPage = { id: uid("page"), title: "새 노트", script: "", memo: "", referenceLinks: [], tags: [] };
    const sections: ScriptSection[] = project.sections.length
      ? project.sections.map((section, index) =>
          index === project.sections.length - 1
            ? { ...section, collapsed: false, pages: [...section.pages, page] }
            : section
        )
      : [{ id: uid("section"), title: "", collapsed: false, pages: [page] }];
    patchProjectMutation({ id: projectId, sections, projectMemos: project.projectMemos });
    setActiveProjectId(projectId);
    setSelectedPageId(page.id);
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function handleMoveProject(orderedIds: Id<"projects">[]) {
    reorderProjectsMutation({ orderedIds });
  }

  function handleDeleteProject(id: Id<"projects">) {
    removeProjectMutation({ id });
  }

  function handleRestoreProject(id: Id<"projects">) {
    restoreProjectMutation({ id });
  }

  function handlePermanentlyDeleteProject(id: Id<"projects">) {
    permanentlyDeleteProjectMutation({ id });
  }

  function handleToggleFavorite(id: Id<"projects">) {
    toggleFavoriteMutation({ id });
  }

  function handleEmojiChange(id: Id<"projects">, emoji: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    updateMetaMutation({ id, name: project.name, siteName: project.siteName, labelColor: project.labelColor, emoji });
  }

  if (projectsQuery === undefined) {
    return <div className="app-loading">불러오는 중...</div>;
  }

  if (!activeProject) return null;

  const themedColor = (value: string, lightDefault: string, darkDefault: string) =>
    uiSettings.theme === "dark" && value.toLowerCase() === lightDefault.toLowerCase() ? darkDefault : value;

  const appStyle = {
    "--sidebar-width": `${uiSettings.navCollapsed ? 72 : uiSettings.sidebarWidth}px`,
    "--nav-font-family": uiSettings.navFontFamily,
    "--nav-font-size": `${uiSettings.navTextSize}px`,
    "--nav-text-color": themedColor(
      uiSettings.navTextColor,
      defaultUISettings.navTextColor,
      darkStyleDefaults.navTextColor
    ),
    "--section-font-family": uiSettings.categoryFontFamily,
    "--section-text-size": `${uiSettings.categoryTextSize}px`,
    "--section-text-color": themedColor(
      uiSettings.categoryTextColor,
      defaultUISettings.categoryTextColor,
      darkStyleDefaults.categoryTextColor
    ),
    "--note-title-font-family": uiSettings.noteTitleFontFamily,
    "--note-title-text-size": `${uiSettings.noteTitleTextSize}px`,
    "--note-title-text-color": themedColor(
      uiSettings.noteTitleTextColor,
      defaultUISettings.noteTitleTextColor,
      darkStyleDefaults.noteTitleTextColor
    ),
    "--note-text-size": `${uiSettings.noteTitleTextSize}px`,
    "--note-text-color": themedColor(
      uiSettings.noteTitleTextColor,
      defaultUISettings.noteTitleTextColor,
      darkStyleDefaults.noteTitleTextColor
    ),
    "--note-bg":
      uiSettings.theme === "dark" &&
      uiSettings.noteBackgroundColor.toLowerCase() === defaultUISettings.noteBackgroundColor.toLowerCase()
        ? darkStyleDefaults.noteBackgroundColor
        : uiSettings.noteBackgroundColor,
    "--note-content-font-family": uiSettings.noteContentFontFamily,
    "--note-content-text-size": `${uiSettings.noteContentTextSize}px`,
    "--note-content-text-color": themedColor(
      uiSettings.noteContentTextColor,
      defaultUISettings.noteContentTextColor,
      darkStyleDefaults.noteContentTextColor
    ),
    "--memo-font-family": uiSettings.memoFontFamily,
    "--memo-text-size": `${uiSettings.memoTextSize}px`,
    "--memo-text-color": themedColor(
      uiSettings.memoTextColor,
      defaultUISettings.memoTextColor,
      darkStyleDefaults.memoTextColor
    ),
    "--memo-bg":
      uiSettings.theme === "dark" &&
      uiSettings.memoBackgroundColor.toLowerCase() === defaultUISettings.memoBackgroundColor.toLowerCase()
        ? darkStyleDefaults.memoBackgroundColor
        : uiSettings.memoBackgroundColor,
    "--page-memo-text-size": `${uiSettings.memoTextSize}px`,
    "--page-memo-text-color": themedColor(
      uiSettings.memoTextColor,
      defaultUISettings.memoTextColor,
      darkStyleDefaults.memoTextColor
    ),
    "--page-memo-bg":
      uiSettings.theme === "dark" &&
      uiSettings.memoBackgroundColor.toLowerCase() === defaultUISettings.memoBackgroundColor.toLowerCase()
        ? darkStyleDefaults.memoBackgroundColor
        : uiSettings.memoBackgroundColor,
    "--link-font-family": uiSettings.linkFontFamily,
    "--link-text-size": `${uiSettings.linkTextSize}px`,
    "--link-text-color": themedColor(
      uiSettings.linkTextColor,
      defaultUISettings.linkTextColor,
      darkStyleDefaults.linkTextColor
    ),
    "--tag-font-family": uiSettings.tagFontFamily,
    "--tag-text-size": `${uiSettings.tagTextSize}px`,
    "--tag-text-color": themedColor(
      uiSettings.tagTextColor,
      defaultUISettings.tagTextColor,
      darkStyleDefaults.tagTextColor
    )
  } as CSSProperties;

  return (
    <div className={`app-shell theme-${uiSettings.theme}`} style={appStyle}>
      <div className="top-right-bar">
        <button
          className={`corner-icon-btn ${view === "settings" ? "active" : ""}`}
          onClick={() => setView("settings")}
          aria-label="설정"
          title="설정"
        >
          <Settings size={17} />
        </button>
        <button
          className="corner-icon-btn"
          onClick={toggleTheme}
          aria-label={uiSettings.theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
        >
          {uiSettings.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
      <GlobalSearch projects={projects} onOpenResult={openSearchResult} />
      <Sidebar
        view={view}
        settings={uiSettings}
        onSettingsChange={setUISettings}
        onNavigate={setView}
        onResizeStart={() => setResizingNav(true)}
        projects={projects}
        activeProjectId={activeProject.id}
        selectedPageId={selectedPageId}
        expandedProjectIds={expandedProjectIds}
        onToggleProjectExpanded={toggleProjectExpanded}
        onToggleAllExpanded={toggleAllExpanded}
        onToggleTreeSection={toggleTreeSection}
        onUpdateProject={updateProject}
        onOpenProject={openProject}
        onSelectTreePage={openSearchResult}
        onMoveProject={handleMoveProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onQuickCreateProject={quickCreateProject}
        onAddNote={addNoteToProject}
        onEmojiChange={handleEmojiChange}
        autoRenameId={autoRenameId}
        onAutoRenameConsumed={() => setAutoRenameId(null)}
      />
      <main className="main-area">
        {view === "home" && (
          <Home
            projects={projects}
            onRequestCreate={() => setCreateOpen(true)}
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
      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} onSubmit={submitCreateProject} />}
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  function permanentlyDelete(project: Project) {
    setConfirmDelete(project);
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

      {confirmDelete && (
        <ConfirmModal
          title="완전 삭제"
          message={`'${confirmDelete.name}' 프로젝트를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="완전 삭제"
          onConfirm={() => {
            onPermanentlyDelete(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
}

type DropMode = "before" | "after";

type TreeDrag =
  | { type: "section"; sectionId: string }
  | { type: "page"; sectionId: string; pageId: string };

interface NavCtx {
  view: View;
  activeProjectId: Id<"projects"> | "";
  selectedPageId: string;
  expandedProjectIds: Set<Id<"projects">>;
  dragId: Id<"projects"> | null;
  drop: { id: Id<"projects">; mode: DropMode } | null;
  onToggleProjectExpanded: (id: Id<"projects">) => void;
  onToggleTreeSection: (projectId: Id<"projects">, sectionId: string) => void;
  onUpdateProject: (projectId: Id<"projects">, updater: (project: Project) => Project) => void;
  onOpenProject: (id: Id<"projects">) => void;
  onSelectTreePage: (projectId: Id<"projects">, pageId: string) => void;
  onRenameProject: (projectId: Id<"projects">, name: string) => void;
  onAddNote: (projectId: Id<"projects">) => void;
  onEmojiChange: (projectId: Id<"projects">, emoji: string) => void;
  autoRenameId: Id<"projects"> | null;
  onAutoRenameConsumed: () => void;
  onRowDragStart: (project: Project, event: DragEvent<HTMLElement>) => void;
  onRowDragOver: (project: Project, event: DragEvent<HTMLElement>) => void;
  onRowDrop: (project: Project, event: DragEvent<HTMLElement>) => void;
  onRowDragEnd: () => void;
  onRowContextMenu: (project: Project, event: MouseEvent<HTMLElement>) => void;
}

function NavProjectNode({ project, ctx }: { project: Project; ctx: NavCtx }) {
  const expanded = ctx.expandedProjectIds.has(project.id);
  const isActive = project.id === ctx.activeProjectId && ctx.view === "project";
  const canExpand = project.sections.some((section) => section.pages.length > 0 || isDividerSection(section));
  const dropClass = ctx.drop && ctx.drop.id === project.id ? `drop-${ctx.drop.mode}` : "";
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [treeDrag, setTreeDrag] = useState<TreeDrag | null>(null);
  const [treeDrop, setTreeDrop] = useState<{ key: string; mode: DropMode | "inside" } | null>(null);
  const [itemMenu, setItemMenu] = useState<{
    type: "section" | "page";
    sectionId: string;
    pageId?: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [confirmDeletePage, setConfirmDeletePage] = useState<{
    sectionId: string;
    pageId: string;
    label: string;
  } | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!itemMenu) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setItemMenu(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemMenu]);

  function onSectionContextMenu(section: ScriptSection, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setItemMenu({ type: "section", sectionId: section.id, label: section.title, x: event.clientX, y: event.clientY });
  }

  function onPageContextMenu(section: ScriptSection, page: ScriptPage, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setItemMenu({
      type: "page",
      sectionId: section.id,
      pageId: page.id,
      label: pageWord(page),
      x: event.clientX,
      y: event.clientY
    });
  }

  function renameSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "section") return;
    const sectionId = itemMenu.sectionId;
    const current = project.sections.find((section) => section.id === sectionId);
    setItemMenu(null);
    const title = window.prompt("구획 이름", current?.title ?? "");
    if (!title?.trim()) return;
    ctx.onUpdateProject(project.id, (proj) => ({
      ...proj,
      sections: proj.sections.map((section) =>
        section.id === sectionId ? { ...section, title: title.trim() } : section
      )
    }));
  }

  // Removing a divider keeps its notes: they merge into the previous section
  // (or back to the project root when it was the first divider).
  function dissolveSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "section") return;
    const sectionId = itemMenu.sectionId;
    setItemMenu(null);
    ctx.onUpdateProject(project.id, (proj) => {
      const index = proj.sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return proj;
      const target = proj.sections[index];
      const sections = proj.sections.filter((section) => section.id !== sectionId);
      if (target.pages.length) {
        if (index === 0) {
          sections.unshift({ id: uid("section"), title: "", collapsed: false, pages: target.pages });
        } else {
          const prev = sections[index - 1];
          sections[index - 1] = { ...prev, collapsed: false, pages: [...prev.pages, ...target.pages] };
        }
      }
      return { ...proj, sections };
    });
  }

  // Insert a divider right above the clicked note: it and the notes after it
  // move into a new section.
  function splitSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    const { sectionId, pageId } = itemMenu;
    setItemMenu(null);
    const title = window.prompt("새 구획 이름", "새 구획");
    if (!title?.trim()) return;
    ctx.onUpdateProject(project.id, (proj) => {
      const sections: ScriptSection[] = [];
      for (const section of proj.sections) {
        if (section.id !== sectionId) {
          sections.push(section);
          continue;
        }
        const index = section.pages.findIndex((page) => page.id === pageId);
        if (index < 0) {
          sections.push(section);
          continue;
        }
        const before = section.pages.slice(0, index);
        if (before.length > 0 || isDividerSection(section)) sections.push({ ...section, pages: before });
        sections.push({ id: uid("section"), title: title.trim(), collapsed: false, pages: section.pages.slice(index) });
      }
      return { ...proj, sections };
    });
  }

  function deletePageFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    setConfirmDeletePage({ sectionId: itemMenu.sectionId, pageId: itemMenu.pageId, label: itemMenu.label });
    setItemMenu(null);
  }

  function confirmDeletePageNow() {
    if (!confirmDeletePage) return;
    const { sectionId, pageId } = confirmDeletePage;
    ctx.onUpdateProject(project.id, (current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, pages: section.pages.filter((page) => page.id !== pageId) } : section
      )
    }));
    setConfirmDeletePage(null);
  }

  useEffect(() => {
    if (ctx.autoRenameId !== project.id) return;
    setRenameDraft(project.name);
    ctx.onAutoRenameConsumed();
  }, [ctx.autoRenameId, project.id]);

  function commitRename() {
    if (renameDraft === null) return;
    const name = renameDraft.trim();
    if (name && name !== project.name) ctx.onRenameProject(project.id, name);
    setRenameDraft(null);
  }

  function halfDropMode(event: DragEvent<HTMLElement>): DropMode {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? "before" : "after";
  }

  function onTreeItemDragStart(item: TreeDrag, event: DragEvent<HTMLElement>) {
    event.stopPropagation();
    setTreeDrag(item);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.type === "section" ? item.sectionId : item.pageId);
  }

  function onTreeDragEnd() {
    setTreeDrag(null);
    setTreeDrop(null);
  }

  function onSectionDragOver(sectionId: string, event: DragEvent<HTMLElement>) {
    if (!treeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    if (treeDrag.type === "section") {
      if (treeDrag.sectionId === sectionId) {
        setTreeDrop(null);
        return;
      }
      setTreeDrop({ key: `section:${sectionId}`, mode: halfDropMode(event) });
    } else {
      setTreeDrop({ key: `section:${sectionId}`, mode: "inside" });
    }
  }

  function movePage(
    drag: { pageId: string },
    toSectionId: string,
    targetPageId: string | undefined,
    mode: DropMode | "inside"
  ) {
    ctx.onUpdateProject(project.id, (current) => {
      let moved: ScriptPage | undefined;
      const stripped = current.sections.map((section) => {
        const found = section.pages.find((page) => page.id === drag.pageId);
        if (found) moved = found;
        return { ...section, pages: section.pages.filter((page) => page.id !== drag.pageId) };
      });
      if (!moved) return current;
      return {
        ...current,
        sections: stripped.map((section) => {
          if (section.id !== toSectionId) return section;
          const pages = [...section.pages];
          const index = targetPageId ? pages.findIndex((page) => page.id === targetPageId) : -1;
          if (index < 0) pages.push(moved!);
          else pages.splice(index + (mode === "after" ? 1 : 0), 0, moved!);
          return { ...section, pages };
        })
      };
    });
  }

  function onSectionDrop(sectionId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const drag = treeDrag;
    const dropInfo = treeDrop;
    onTreeDragEnd();
    if (!drag || !dropInfo || dropInfo.key !== `section:${sectionId}`) return;
    if (drag.type === "section") {
      ctx.onUpdateProject(project.id, (current) => {
        const ids = current.sections.map((section) => section.id).filter((id) => id !== drag.sectionId);
        const index = ids.indexOf(sectionId);
        if (index < 0) return current;
        ids.splice(index + (dropInfo.mode === "after" ? 1 : 0), 0, drag.sectionId);
        const byId = new Map(current.sections.map((section) => [section.id, section]));
        return { ...current, sections: ids.map((id) => byId.get(id)!) };
      });
    } else {
      movePage(drag, sectionId, undefined, "after");
    }
  }

  function onPageDragOver(pageId: string, event: DragEvent<HTMLElement>) {
    if (!treeDrag || treeDrag.type !== "page") return;
    event.preventDefault();
    event.stopPropagation();
    if (treeDrag.pageId === pageId) {
      setTreeDrop(null);
      return;
    }
    setTreeDrop({ key: `page:${pageId}`, mode: halfDropMode(event) });
  }

  function onPageDrop(sectionId: string, pageId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const drag = treeDrag;
    const dropInfo = treeDrop;
    onTreeDragEnd();
    if (!drag || drag.type !== "page" || !dropInfo || dropInfo.key !== `page:${pageId}`) return;
    movePage(drag, sectionId, pageId, dropInfo.mode);
  }

  return (
    <div className="nav-tree-project">
      <div
        className={`nav-tree-project-head ${isActive ? "active" : ""} ${
          ctx.dragId === project.id ? "dragging" : ""
        } ${dropClass}`}
        draggable={renameDraft === null}
        onDragStart={(event) => ctx.onRowDragStart(project, event)}
        onDragOver={(event) => ctx.onRowDragOver(project, event)}
        onDrop={(event) => ctx.onRowDrop(project, event)}
        onDragEnd={ctx.onRowDragEnd}
        onContextMenu={(event) => ctx.onRowContextMenu(project, event)}
        title={project.name}
      >
        {canExpand ? (
          <button
            type="button"
            className="tree-caret"
            onClick={(event) => {
              event.stopPropagation();
              ctx.onToggleProjectExpanded(project.id);
            }}
            aria-label={expanded ? "접기" : "펼치기"}
          >
            <ChevronDown size={16} className={expanded ? "" : "rotated"} />
          </button>
        ) : (
          <span className="tree-caret spacer" />
        )}
        <button
          type="button"
          className="nav-emoji-btn"
          onClick={(event) => {
            event.stopPropagation();
            setEmojiPickerOpen(true);
          }}
          aria-label="이모지 변경"
          title="이모지 변경"
        >
          {project.emoji}
        </button>
        {renameDraft !== null ? (
          <input
            className="nav-rename-input"
            value={renameDraft}
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setRenameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              else if (event.key === "Escape") setRenameDraft(null);
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label="이름 변경"
          />
        ) : (
          <button
            type="button"
            className="nav-tree-project-label"
            onClick={() => ctx.onOpenProject(project.id)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              setRenameDraft(project.name);
            }}
          >
            {project.name}
          </button>
        )}
        <button
          type="button"
          className="tree-add"
          onClick={(event) => {
            event.stopPropagation();
            ctx.onAddNote(project.id);
          }}
          aria-label="새 노트 추가"
          title="새 노트 추가"
        >
          <Plus size={13} />
        </button>
      </div>

      {expanded && (
        <div className="nav-children">
          {/* First, render all divider sections (sections with titles) */}
          {project.sections.map((section) => {
            const divider = isDividerSection(section);
            if (!divider) return null;
            return (
              <Fragment key={section.id}>
                <button
                  type="button"
                  className={`nav-tree-section-head ${
                    treeDrop?.key === `section:${section.id}` ? `drop-${treeDrop.mode}` : ""
                  }`}
                  onClick={() => ctx.onToggleTreeSection(project.id, section.id)}
                  title={section.title}
                  draggable
                  onDragStart={(event) => onTreeItemDragStart({ type: "section", sectionId: section.id }, event)}
                  onDragOver={(event) => onSectionDragOver(section.id, event)}
                  onDrop={(event) => onSectionDrop(section.id, event)}
                  onDragEnd={onTreeDragEnd}
                  onContextMenu={(event) => onSectionContextMenu(section, event)}
                >
                  <ChevronDown size={12} className={section.collapsed ? "rotated" : ""} />
                  <span className="nav-tree-section-label">{section.title}</span>
                </button>
                {!section.collapsed &&
                  section.pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      className={`nav-tree-page ${isActive && page.id === ctx.selectedPageId ? "active" : ""} ${
                        treeDrop?.key === `page:${page.id}` ? `drop-${treeDrop.mode}` : ""
                      }`}
                      onClick={() => ctx.onSelectTreePage(project.id, page.id)}
                      title={pageWord(page)}
                      draggable
                      onDragStart={(event) =>
                        onTreeItemDragStart({ type: "page", sectionId: section.id, pageId: page.id }, event)
                      }
                      onDragOver={(event) => onPageDragOver(page.id, event)}
                      onDrop={(event) => onPageDrop(section.id, page.id, event)}
                      onDragEnd={onTreeDragEnd}
                      onContextMenu={(event) => onPageContextMenu(section, page, event)}
                    >
                      {pageWord(page)}
                    </button>
                  ))}
              </Fragment>
            );
          })}
          {/* Then, render pages from implicit sections (sections with empty titles) */}
          {project.sections.map((section) => {
            const divider = isDividerSection(section);
            if (divider) return null;
            return section.pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`nav-tree-page ${isActive && page.id === ctx.selectedPageId ? "active" : ""} ${
                  treeDrop?.key === `page:${page.id}` ? `drop-${treeDrop.mode}` : ""
                }`}
                onClick={() => ctx.onSelectTreePage(project.id, page.id)}
                title={pageWord(page)}
                draggable
                onDragStart={(event) =>
                  onTreeItemDragStart({ type: "page", sectionId: section.id, pageId: page.id }, event)
                }
                onDragOver={(event) => onPageDragOver(page.id, event)}
                onDrop={(event) => onPageDrop(section.id, page.id, event)}
                onDragEnd={onTreeDragEnd}
                onContextMenu={(event) => onPageContextMenu(section, page, event)}
              >
                {pageWord(page)}
              </button>
            ));
          })}
        </div>
      )}
      {itemMenu && (
        <div
          className="context-menu-overlay"
          onMouseDown={() => setItemMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setItemMenu(null);
          }}
        >
          <div
            className="context-menu"
            role="menu"
            style={{
              left: Math.min(itemMenu.x, window.innerWidth - 188),
              top: Math.min(itemMenu.y, window.innerHeight - 104)
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {itemMenu.type === "section" ? (
              <>
                <button type="button" role="menuitem" className="context-menu-item" onClick={renameSectionFromMenu}>
                  <Pencil size={14} />
                  구획 이름 변경
                </button>
                <button type="button" role="menuitem" className="context-menu-item" onClick={dissolveSectionFromMenu}>
                  <Trash2 size={14} />
                  구획 해제 (노트 유지)
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" className="context-menu-item" onClick={splitSectionFromMenu}>
                  <Plus size={14} />
                  여기부터 새 구획
                </button>
                <button type="button" role="menuitem" className="context-menu-item danger" onClick={deletePageFromMenu}>
                  <Trash2 size={14} />
                  노트 삭제
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {confirmDeletePage && (
        <ConfirmModal
          title="노트 삭제"
          message={`'${confirmDeletePage.label}' 노트를 삭제하시겠습니까?`}
          confirmLabel="삭제"
          onConfirm={confirmDeletePageNow}
          onClose={() => setConfirmDeletePage(null)}
        />
      )}
      {emojiPickerOpen && (
        <EmojiPicker
          onPick={(emoji) => {
            ctx.onEmojiChange(project.id, emoji);
            setEmojiPickerOpen(false);
          }}
          onClose={() => setEmojiPickerOpen(false)}
        />
      )}
    </div>
  );
}

function Sidebar({
  view,
  settings,
  onSettingsChange,
  onNavigate,
  onResizeStart,
  projects,
  activeProjectId,
  selectedPageId,
  expandedProjectIds,
  onToggleProjectExpanded,
  onToggleAllExpanded,
  onToggleTreeSection,
  onUpdateProject,
  onOpenProject,
  onSelectTreePage,
  onMoveProject,
  onRenameProject,
  onDeleteProject,
  onQuickCreateProject,
  onAddNote,
  onEmojiChange,
  autoRenameId,
  onAutoRenameConsumed
}: {
  view: View;
  settings: UISettings;
  onSettingsChange: (settings: UISettings | ((settings: UISettings) => UISettings)) => void;
  onNavigate: (view: View) => void;
  onResizeStart: () => void;
  projects: Project[];
  activeProjectId: Id<"projects"> | "";
  selectedPageId: string;
  expandedProjectIds: Set<Id<"projects">>;
  onToggleProjectExpanded: (projectId: Id<"projects">) => void;
  onToggleAllExpanded: () => void;
  onToggleTreeSection: (projectId: Id<"projects">, sectionId: string) => void;
  onUpdateProject: (projectId: Id<"projects">, updater: (project: Project) => Project) => void;
  onOpenProject: (projectId: Id<"projects">) => void;
  onSelectTreePage: (projectId: Id<"projects">, pageId: string) => void;
  onMoveProject: (orderedIds: Id<"projects">[]) => void;
  onRenameProject: (projectId: Id<"projects">, name: string) => void;
  onDeleteProject: (projectId: Id<"projects">) => void;
  onQuickCreateProject: () => void;
  onAddNote: (projectId: Id<"projects">) => void;
  onEmojiChange: (projectId: Id<"projects">, emoji: string) => void;
  autoRenameId: Id<"projects"> | null;
  onAutoRenameConsumed: () => void;
}) {
  const [dragId, setDragId] = useState<Id<"projects"> | null>(null);
  const [drop, setDrop] = useState<{ id: Id<"projects">; mode: DropMode } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: Id<"projects">; x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  useEffect(() => {
    if (!contextMenu) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);

  function computeDropPlan(target: Project, mode: DropMode): Id<"projects">[] | null {
    if (!dragId || dragId === target.id) return null;
    const siblings = projectChildren(projects, undefined).filter((sibling) => sibling.id !== dragId);
    const index = siblings.findIndex((sibling) => sibling.id === target.id);
    if (index < 0) return null;
    const insertAt = mode === "after" ? index + 1 : index;
    const orderedIds = siblings.map((sibling) => sibling.id);
    orderedIds.splice(insertAt, 0, dragId);
    return orderedIds;
  }

  function onRowDragStart(project: Project, event: DragEvent<HTMLElement>) {
    event.stopPropagation();
    setDragId(project.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", project.id);
  }

  function onRowDragOver(project: Project, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragId || dragId === project.id) {
      setDrop(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const mode: DropMode = event.clientY - rect.top < (rect.height || 1) / 2 ? "before" : "after";
    if (!computeDropPlan(project, mode)) {
      setDrop(null);
      return;
    }
    setDrop({ id: project.id, mode });
  }

  function onRowDrop(project: Project, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (dragId && drop && drop.id === project.id) {
      const orderedIds = computeDropPlan(project, drop.mode);
      if (orderedIds) onMoveProject(orderedIds);
    }
    setDragId(null);
    setDrop(null);
  }

  function onRowDragEnd() {
    setDragId(null);
    setDrop(null);
  }

  function onRowContextMenu(project: Project, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ id: project.id, x: event.clientX, y: event.clientY });
  }

  function deleteFromMenu(target: Project) {
    setContextMenu(null);
    setConfirmDelete(target);
  }

  const ctx: NavCtx = {
    view,
    activeProjectId,
    selectedPageId,
    expandedProjectIds,
    dragId,
    drop,
    onToggleProjectExpanded,
    onToggleTreeSection,
    onUpdateProject,
    onOpenProject,
    onSelectTreePage,
    onRenameProject,
    onAddNote,
    onEmojiChange,
    autoRenameId,
    onAutoRenameConsumed,
    onRowDragStart,
    onRowDragOver,
    onRowDrop,
    onRowDragEnd,
    onRowContextMenu
  };

  const roots = projectChildren(projects, undefined);

  return (
    <aside className={`sidebar ${settings.navCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <button className="brand" onClick={() => onNavigate("home")}>
          <span className="brand-mark">PT</span>
          <span className="brand-label">PT Script Manager</span>
        </button>
        <button
          className="collapse-btn"
          onClick={() => onSettingsChange((current) => ({ ...current, navCollapsed: !current.navCollapsed }))}
          aria-label={settings.navCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {settings.navCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      {!settings.navCollapsed && (
        <>
          <button
            type="button"
            className="nav-note-add"
            onClick={() => activeProjectId && onAddNote(activeProjectId)}
            disabled={!activeProjectId}
            title="선택한 프로젝트에 새 노트를 추가합니다"
          >
            <Plus size={20} />새 노트
          </button>
          <div className="nav-tree-header">
            <span>프로젝트</span>
            <span className="nav-tree-header-tools">
              <button
                type="button"
                className="tree-add"
                onClick={onToggleAllExpanded}
                aria-label={expandedProjectIds.size > 0 ? "모두 접기" : "모두 펼치기"}
                title={expandedProjectIds.size > 0 ? "모두 접기" : "모두 펼치기"}
              >
                {expandedProjectIds.size > 0 ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
              </button>
              <button
                type="button"
                className="tree-add"
                onClick={onQuickCreateProject}
                aria-label="새 프로젝트 만들기"
                title="새 프로젝트 만들기"
              >
                <Plus size={15} />
              </button>
            </span>
          </div>
          <nav className="nav-tree" aria-label="프로젝트 탐색">
            {roots.map((project) => (
              <NavProjectNode key={project.id} project={project} ctx={ctx} />
            ))}
          </nav>
        </>
      )}
      {!settings.navCollapsed && (
        <div className="resize-handle" onMouseDown={onResizeStart} role="separator" aria-label="네비게이션 폭 조절" />
      )}
      {contextMenu &&
        (() => {
          const target = projects.find((project) => project.id === contextMenu.id);
          if (!target) return null;
          return (
            <div
              className="context-menu-overlay"
              onMouseDown={() => setContextMenu(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu(null);
              }}
            >
              <div
                className="context-menu"
                role="menu"
                style={{
                  left: Math.min(contextMenu.x, window.innerWidth - 168),
                  top: Math.min(contextMenu.y, window.innerHeight - 56)
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button type="button" role="menuitem" className="context-menu-item danger" onClick={() => deleteFromMenu(target)}>
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>
          );
        })()}
      {confirmDelete && (
        <ConfirmModal
          title="항목 삭제"
          message={`'${confirmDelete.name}' 항목을 삭제하시겠습니까? 삭제된 항목은 휴지통으로 이동합니다.`}
          confirmLabel="삭제"
          onConfirm={() => {
            onDeleteProject(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </aside>
  );
}

function GlobalSearch({
  projects,
  onOpenResult
}: {
  projects: Project[];
  onOpenResult: (projectId: Id<"projects">, pageId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return projects
      .flatMap((project) =>
        project.sections.flatMap((section) =>
          section.pages.map((page) => {
            const haystack = [
              project.name,
              project.siteName,
              section.title,
              page.title,
              page.script,
              page.memo,
              ...(page.referenceLinks ?? []),
              ...(page.tags ?? [])
            ]
              .join(" ")
              .toLowerCase();
            return { project, section, page, matched: haystack.includes(normalizedQuery) };
          })
        )
      )
      .filter((item) => item.matched)
      .slice(0, 8);
  }, [normalizedQuery, projects]);

  function open(projectId: Id<"projects">, pageId: string) {
    onOpenResult(projectId, pageId);
    setQuery("");
    setFocused(false);
  }

  return (
    <div className="global-search">
      <label className="global-search-box">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="모든 프로젝트, 페이지, 태그 검색"
        />
      </label>
      {focused && normalizedQuery && (
        <div className="global-search-results">
          {results.length ? (
            results.map((item) => (
              <button key={`${item.project.id}-${item.page.id}`} onMouseDown={() => open(item.project.id, item.page.id)}>
                <span>
                  <strong>{item.page.title}</strong>
                  <small>
                    {item.project.name} / {item.section.title}
                  </small>
                </span>
                {item.page.tags?.length > 0 && <em>{item.page.tags.slice(0, 3).join(", ")}</em>}
              </button>
            ))
          ) : (
            <p>검색 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Home({
  projects,
  onRequestCreate,
  onEditProject,
  onDeleteProject,
  onToggleFavorite,
  onOpenProject,
  onSelectProject,
  activeProjectId,
  onOpenTrash
}: {
  projects: Project[];
  onRequestCreate: () => void;
  onEditProject: (id: Id<"projects">, input: { name: string; siteName: string; labelColor: LabelColor }) => void;
  onDeleteProject: (id: Id<"projects">) => void;
  onToggleFavorite: (id: Id<"projects">) => void;
  onOpenProject: (projectId: Id<"projects">) => void;
  onSelectProject: (projectId: Id<"projects"> | "") => void;
  activeProjectId: Id<"projects"> | "";
  onOpenTrash: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [folderForm, setFolderForm] = useState({
    name: "",
    siteName: "",
    labelColor: "green" as LabelColor
  });

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...projects]
      .filter((project) => `${project.name} ${project.siteName}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "ko");
        if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [projects, query, sort]);

  function openEdit(project: Project) {
    setEditing(project);
    setFolderForm({
      name: project.name,
      siteName: project.siteName,
      labelColor: project.labelColor
    });
  }

  function saveFolder(event: FormEvent) {
    event.preventDefault();
    if (!editing || !folderForm.name.trim()) return;
    onEditProject(editing.id, {
      name: folderForm.name.trim(),
      siteName: folderForm.siteName.trim(),
      labelColor: folderForm.labelColor
    });
    setEditing(null);
  }

  function deleteProject(projectId: Id<"projects">) {
    const target = projects.find((project) => project.id === projectId);
    if (target) setConfirmDelete(target);
  }

  function confirmDeleteProject(target: Project) {
    setConfirmDelete(null);
    const next = projects.filter((project) => project.id !== target.id);
    onDeleteProject(target.id);
    if (activeProjectId === target.id) onSelectProject(next[0]?.id ?? "");
  }

  function toggleFavorite(projectId: Id<"projects">) {
    onToggleFavorite(projectId);
  }

  return (
    <section className="screen-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Project folders</p>
          <h1>제안 발표 프로젝트</h1>
          <p className="subcopy">사업지별 폴더를 만들고, 최근 수정 순서로 발표 원고 작업을 이어갑니다.</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={onOpenTrash}>
            <Trash2 size={16} />
            휴지통
          </button>
          <button className="btn" onClick={() => openEdit(projects.find((p) => p.id === activeProjectId) ?? projects[0])}>
            <Pencil size={16} />
            이름 변경
          </button>
          <button className="btn primary" onClick={onRequestCreate}>
            <Plus size={16} />새 프로젝트
          </button>
        </div>
      </header>

      <div className="filter-row">
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트명 또는 사업지 검색" />
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value as "recent" | "name")} className="select">
          <option value="recent">최근 수정순</option>
          <option value="name">이름순</option>
        </select>
        <div className="segmented" aria-label="보기 방식">
          <button className={mode === "grid" ? "active" : ""} onClick={() => setMode("grid")} aria-label="카드 보기">
            <LayoutGrid size={17} />
          </button>
          <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")} aria-label="목록 보기">
            <List size={17} />
          </button>
        </div>
      </div>

      <div className={`folder-list ${mode}`}>
        {visibleProjects.map((project) => {
          const pageCount = flattenPages(project).length;
          return (
            <article key={project.id} className={`folder-card ${project.id === activeProjectId ? "selected" : ""}`}>
              <button className="folder-main" onClick={() => onOpenProject(project.id)}>
                <span className={`label-strip ${project.labelColor}`} />
                <span className="folder-title">{project.name}</span>
                <span className="folder-site">{project.siteName}</span>
                <span className="folder-meta">
                  <span>{pageCount}페이지</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </span>
              </button>
              <div className="folder-tools">
                <button className="icon-btn" onClick={() => toggleFavorite(project.id)} aria-label="즐겨찾기">
                  <Star size={17} fill={project.favorite ? "currentColor" : "none"} />
                </button>
                <button className="icon-btn" onClick={() => openEdit(project)} aria-label="이름 변경">
                  <Pencil size={16} />
                </button>
                <button className="icon-btn danger" onClick={() => deleteProject(project.id)} aria-label="삭제">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!visibleProjects.length && <div className="empty-state">검색 결과가 없습니다.</div>}

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={saveFolder}>
            <h2>프로젝트 수정</h2>
            <label className="field">
              프로젝트명
              <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} />
            </label>
            <label className="field">
              사업지명
              <input
                value={folderForm.siteName}
                onChange={(event) => setFolderForm({ ...folderForm, siteName: event.target.value })}
              />
            </label>
            <div className="swatches" aria-label="라벨 색상">
              {(["green", "blue", "orange", "violet"] as LabelColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch ${color} ${folderForm.labelColor === color ? "active" : ""}`}
                  onClick={() => setFolderForm({ ...folderForm, labelColor: color })}
                  aria-label={`${color} label`}
                />
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setEditing(null)}>
                취소
              </button>
              <button className="btn primary" type="submit">
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="프로젝트 삭제"
          message={`'${confirmDelete.name}' 프로젝트를 삭제하시겠습니까? 삭제된 프로젝트는 휴지통으로 이동합니다.`}
          confirmLabel="삭제"
          onConfirm={() => confirmDeleteProject(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
}

function CreateProjectModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (input: { name: string; siteName: string; labelColor: LabelColor }) => void | Promise<void>;
}) {
  const [form, setForm] = useState<{ name: string; siteName: string; labelColor: LabelColor }>({
    name: "",
    siteName: "",
    labelColor: "green"
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({
      name: form.name.trim(),
      siteName: form.siteName.trim(),
      labelColor: form.labelColor
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <h2>새 프로젝트 만들기</h2>
        <label className="field">
          프로젝트 이름
          <input
            autoFocus
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="예: 북항 제안 발표"
          />
        </label>
        <label className="field">
          사업지명
          <input
            value={form.siteName}
            onChange={(event) => setForm({ ...form, siteName: event.target.value })}
            placeholder="예: 부산 북항 2단계 사업지"
          />
        </label>
        <div className="swatches" aria-label="라벨 색상">
          {(["green", "blue", "orange", "violet"] as LabelColor[]).map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch ${color} ${form.labelColor === color ? "active" : ""}`}
              onClick={() => setForm({ ...form, labelColor: color })}
              aria-label={`${color} label`}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn" type="button" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" type="submit">
            만들기
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectDetail({
  project,
  selectedPageId,
  onSelectPage,
  onUpdateProject,
  onNavigate
}: {
  project: Project;
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
  onUpdateProject: (updater: (project: Project) => Project) => void;
  onNavigate: (view: View) => void;
}) {
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dropMarker, setDropMarker] = useState<DropMarker | null>(null);
  const [pageContextMenu, setPageContextMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState({ memo: true, links: false, tags: false });
  const [tagDraft, setTagDraft] = useState("");
  const flatPages = flattenPages(project);
  const selected = flatPages.find((item) => item.page.id === selectedPageId) ?? flatPages[0];
  const selectedPage = selected?.page;

  useEffect(() => {
    if (!pageContextMenu) return undefined;
    function closeMenu() {
      setPageContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [pageContextMenu]);

  function pageNumber(pageId: string) {
    return flatPages.findIndex((item) => item.page.id === pageId) + 1;
  }

  function updateSelectedPage(patch: Partial<ScriptPage>) {
    if (!selectedPage) return;
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        pages: section.pages.map((page) => (page.id === selectedPage.id ? { ...page, ...patch } : page))
      }))
    }));
  }

  function renameSection(sectionId: string) {
    const section = project.sections.find((item) => item.id === sectionId);
    const title = window.prompt("섹션 이름", section?.title ?? "");
    if (!title?.trim()) return;
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((item) => (item.id === sectionId ? { ...item, title: title.trim() } : item))
    }));
  }

  function toggleSection(sectionId: string) {
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section
      )
    }));
  }

  function addSection() {
    const sectionId = uid("section");
    onUpdateProject((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: sectionId,
          title: "새 구획",
          collapsed: false,
          pages: []
        }
      ]
    }));
  }

  function deleteSection(sectionId: string) {
    if (project.sections.length <= 1) return;
    const section = project.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const hasContent = section.pages.some((page) =>
      [page.title, page.script, page.memo, ...(page.referenceLinks ?? []), ...(page.tags ?? [])].some((value) => value.trim())
    );
    const message = hasContent
      ? `"${section.title}" 구획 안에 작성된 페이지가 있습니다. 구획과 포함된 페이지를 삭제할까요?`
      : `"${section.title}" 구획을 삭제할까요?`;
    if (!window.confirm(message)) return;
    const remainingPages = flatPages.filter((item) => item.section.id !== sectionId);
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.filter((item) => item.id !== sectionId)
    }));
    if (section.pages.some((page) => page.id === selectedPageId)) onSelectPage(remainingPages[0]?.page.id ?? "");
  }

  function addPage(sectionId = selected?.section.id ?? project.sections[0]?.id) {
    const page: ScriptPage = {
      id: uid("page"),
      title: "새 노트",
      script: "",
      memo: "",
      referenceLinks: [],
      tags: []
    };
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, pages: [...section.pages, page] } : section
      )
    }));
    onSelectPage(page.id);
  }

  function duplicatePage() {
    if (!selectedPage) return;
    const copyPage: ScriptPage = {
      ...selectedPage,
      id: uid("page"),
      title: `${selectedPage.title} 복사본`
    };
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        const index = section.pages.findIndex((page) => page.id === selectedPage.id);
        if (index < 0) return section;
        const pages = [...section.pages];
        pages.splice(index + 1, 0, copyPage);
        return { ...section, pages };
      })
    }));
    onSelectPage(copyPage.id);
  }

  function deletePageById(pageId: string) {
    if (flatPages.length <= 1) return;
    const target = flatPages.find((item) => item.page.id === pageId)?.page;
    const hasContent = Boolean(
      target &&
        [target.title, target.script, target.memo, ...(target.referenceLinks ?? []), ...(target.tags ?? [])].some((value) =>
          value.trim()
        )
    );
    if (hasContent && !window.confirm("이 페이지 안에 작성된 내용이 있습니다. 삭제할까요?")) {
      setPageContextMenu(null);
      return;
    }
    const fallback = flatPages.find((item) => item.page.id !== pageId)?.page.id ?? "";
    onUpdateProject((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        pages: section.pages.filter((page) => page.id !== pageId)
      }))
    }));
    onSelectPage(fallback);
    setPageContextMenu(null);
  }

  function openPageContextMenu(event: MouseEvent, pageId: string) {
    event.preventDefault();
    event.stopPropagation();
    onSelectPage(pageId);
    setPageContextMenu({ pageId, x: event.clientX, y: event.clientY });
  }

  function getPageDropPosition(event: DragEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function getSectionDropPosition(event: DragEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function handleDrop(target: { sectionId: string; pageId?: string; position?: "before" | "after" }) {
    if (!dragInfo) return;
    if (dragInfo.type === "section") {
      onUpdateProject((current) => {
        const movedSection = current.sections.find((section) => section.id === dragInfo.sectionId);
        if (!movedSection || movedSection.id === target.sectionId) return current;
        const sections = current.sections.filter((section) => section.id !== dragInfo.sectionId);
        const targetIndex = sections.findIndex((section) => section.id === target.sectionId);
        if (targetIndex < 0) return current;
        const insertIndex = targetIndex + (target.position === "after" ? 1 : 0);
        sections.splice(insertIndex, 0, movedSection);
        return { ...current, sections };
      });
    }
    if (dragInfo.type === "page") {
      onUpdateProject((current) => {
        const sourceSection = current.sections.find((section) => section.id === dragInfo.sectionId);
        const movedPage = sourceSection?.pages.find((page) => page.id === dragInfo.pageId);
        if (!movedPage) return current;
        let sections = current.sections.map((section) =>
          section.id === dragInfo.sectionId
            ? { ...section, pages: section.pages.filter((page) => page.id !== dragInfo.pageId) }
            : { ...section, pages: [...section.pages] }
        );
        sections = sections.map((section) => {
          if (section.id !== target.sectionId) return section;
          const baseIndex = target.pageId ? section.pages.findIndex((page) => page.id === target.pageId) : -1;
          const insertIndex =
            baseIndex >= 0 ? baseIndex + (target.position === "after" ? 1 : 0) : section.pages.length;
          const pages = [...section.pages];
          pages.splice(insertIndex, 0, movedPage);
          return { ...section, pages };
        });
        return { ...current, sections };
      });
    }
    setDropMarker(null);
    setDragInfo(null);
  }

  function toggleDetail(key: keyof typeof detailOpen) {
    setDetailOpen((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateReferenceLink(index: number, value: string) {
    if (!selectedPage) return;
    const links = [...(selectedPage.referenceLinks ?? [])];
    links[index] = value;
    updateSelectedPage({ referenceLinks: links });
  }

  function addReferenceLink() {
    if (!selectedPage) return;
    updateSelectedPage({ referenceLinks: [...(selectedPage.referenceLinks ?? []), ""] });
    setDetailOpen((current) => ({ ...current, links: true }));
  }

  function removeReferenceLink(index: number) {
    if (!selectedPage) return;
    updateSelectedPage({ referenceLinks: (selectedPage.referenceLinks ?? []).filter((_, linkIndex) => linkIndex !== index) });
  }

  function addTagFromDraft() {
    if (!selectedPage) return;
    const nextTag = tagDraft.trim().replace(/^#/, "");
    if (!nextTag) return;
    const tags = selectedPage.tags ?? [];
    if (!tags.includes(nextTag)) updateSelectedPage({ tags: [...tags, nextTag] });
    setTagDraft("");
    setDetailOpen((current) => ({ ...current, tags: true }));
  }

  function removeTag(tag: string) {
    if (!selectedPage) return;
    updateSelectedPage({ tags: (selectedPage.tags ?? []).filter((item) => item !== tag) });
  }

  const totalSeconds = estimateSeconds(project);

  return (
    <section className="project-screen">
      <header className="project-topbar">
        <div>
          <button className="text-link mobile-only" onClick={() => onNavigate("home")}>
            <ArrowLeft size={16} />홈
          </button>
          <h1>{project.name}</h1>
          <div className="stats">
            <span>총 {flatPages.length}페이지</span>
            <span>예상 {formatDuration(totalSeconds)}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => addPage()}>
            <Plus size={16} />
            노트
          </button>
          <button className="btn" onClick={duplicatePage}>
            <Copy size={16} />
            복제
          </button>
          <button className="btn" onClick={() => onNavigate("memos")}>
            <Pin size={16} />
            메모
          </button>
          <button className="btn primary" onClick={() => onNavigate("export")}>
            <Download size={16} />
            내보내기
          </button>
        </div>
      </header>

      <div className="project-workspace">
        <aside className="page-tree">
          <div className="page-tree-toolbar">
            <strong>구획 / 노트</strong>
            <button className="btn subtle compact" onClick={addSection}>
              <Plus size={16} />
              구획
            </button>
          </div>
          {project.sections.map((section) => (
            <section
              key={section.id}
              className={`tree-section ${section.collapsed ? "collapsed" : ""} ${
                dropMarker?.type === "section" && dropMarker.sectionId === section.id
                  ? dropMarker.position === "before"
                    ? "insert-before"
                    : "insert-after"
                  : dropMarker?.type === "section-end" && dropMarker.sectionId === section.id
                    ? "page-drop-target"
                  : ""
              }`}
              draggable
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest(".page-row, .section-tools button")) return;
                setDragInfo({ type: "section", sectionId: section.id });
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (dragInfo?.type === "section") {
                  setDropMarker({ type: "section", sectionId: section.id, position: getSectionDropPosition(event) });
                }
                if (dragInfo?.type === "page" && section.collapsed) {
                  setDropMarker({ type: "section-end", sectionId: section.id });
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleDrop({ sectionId: section.id, position: getSectionDropPosition(event) });
              }}
              onDragEnd={() => {
                setDropMarker(null);
                setDragInfo(null);
              }}
            >
              {isDividerSection(section) && (
                <div className="section-head">
                  <button onClick={() => toggleSection(section.id)}>
                    <ChevronDown size={15} className={section.collapsed ? "rotated" : ""} />
                    {section.title}
                  </button>
                  <div className="section-tools">
                    <button className="mini-icon" onClick={() => renameSection(section.id)} aria-label="섹션 이름 변경">
                      <Pencil size={14} />
                    </button>
                    <button className="mini-icon" onClick={() => addPage(section.id)} aria-label="섹션에 노트 추가">
                      <Plus size={14} />
                    </button>
                    <button
                      className="mini-icon danger"
                      onClick={() => deleteSection(section.id)}
                      disabled={project.sections.length <= 1}
                      aria-label="섹션 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
              {(!isDividerSection(section) || !section.collapsed) && (
                <div
                  className={`page-list ${
                    dropMarker?.type === "section-end" && dropMarker.sectionId === section.id ? "insert-at-end" : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragInfo?.type === "page") {
                      event.stopPropagation();
                      setDropMarker({ type: "section-end", sectionId: section.id });
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragInfo?.type === "page") event.stopPropagation();
                    handleDrop({ sectionId: section.id });
                  }}
                >
                  {section.pages.map((page) => (
                    <button
                      key={page.id}
                      className={`page-row ${page.id === selectedPageId ? "active" : ""} ${
                        dropMarker?.type === "page" && dropMarker.pageId === page.id
                          ? dropMarker.position === "before"
                            ? "insert-before"
                            : "insert-after"
                          : ""
                      }`}
                      draggable
                      onClick={() => onSelectPage(page.id)}
                      onContextMenu={(event) => openPageContextMenu(event, page.id)}
                      onDragStart={() => setDragInfo({ type: "page", pageId: page.id, sectionId: section.id })}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDropMarker({ type: "page", pageId: page.id, position: getPageDropPosition(event) });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDrop({ sectionId: section.id, pageId: page.id, position: getPageDropPosition(event) });
                      }}
                      onDragEnd={() => {
                        setDropMarker(null);
                        setDragInfo(null);
                      }}
                    >
                      <GripVertical size={15} />
                      <span className="page-num">P.{pageNumber(page.id)}</span>
                      <span className="page-title">{pageWord(page)}</span>
                      {page.memo.trim() && <span className="memo-dot" />}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
          {pageContextMenu && (
            <div className="context-menu" style={{ left: pageContextMenu.x, top: pageContextMenu.y }}>
              <button onClick={() => deletePageById(pageContextMenu.pageId)} disabled={flatPages.length <= 1}>
                <Trash2 size={15} />
                페이지 삭제
              </button>
            </div>
          )}
        </aside>

        <section className="editor-pane">
          {selectedPage && (
            <article className="editor-surface">
              <div className="editor-head">
                <input
                  className="title-input"
                  value={selectedPage.title}
                  onChange={(event) => updateSelectedPage({ title: event.target.value })}
                  aria-label="페이지 제목"
                />
              </div>
              <textarea
                className="script-editor"
                value={selectedPage.script}
                onChange={(event) => updateSelectedPage({ script: event.target.value })}
                aria-label="발표 원고"
              />
              <div className="page-details">
                <section className="detail-section">
                  <button className="detail-summary" onClick={() => toggleDetail("memo")}>
                    <ChevronDown size={16} className={detailOpen.memo ? "" : "rotated"} />
                    <strong>페이지 메모</strong>
                    <span>{selectedPage.memo.trim() ? "메모 있음" : "접어둘 수 있는 짧은 메모"}</span>
                  </button>
                  {detailOpen.memo && (
                    <div className="detail-body">
                      <textarea
                        className="memo-input"
                        value={selectedPage.memo}
                        onChange={(event) => updateSelectedPage({ memo: event.target.value })}
                        placeholder="짧은 주의점, 질문 대비, 발표 피드백"
                      />
                    </div>
                  )}
                </section>

                <section className="detail-section">
                  <button className="detail-summary" onClick={() => toggleDetail("links")}>
                    <ChevronDown size={16} className={detailOpen.links ? "" : "rotated"} />
                    <strong>참고 링크</strong>
                    <span>{(selectedPage.referenceLinks ?? []).filter(Boolean).length}개 링크</span>
                  </button>
                  {detailOpen.links && (
                    <div className="detail-body link-list">
                      {(selectedPage.referenceLinks ?? []).map((link, index) => (
                        <div className="link-row" key={`${selectedPage.id}-link-${index}`}>
                          <input
                            value={link}
                            onChange={(event) => updateReferenceLink(index, event.target.value)}
                            placeholder="https://example.com/reference"
                          />
                          <button className="mini-icon danger" onClick={() => removeReferenceLink(index)} aria-label="참고 링크 삭제">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <button className="btn subtle add-link-btn" onClick={addReferenceLink}>
                        <Plus size={16} />
                        링크 추가
                      </button>
                    </div>
                  )}
                </section>

                <section className="detail-section">
                  <button className="detail-summary" onClick={() => toggleDetail("tags")}>
                    <ChevronDown size={16} className={detailOpen.tags ? "" : "rotated"} />
                    <strong>검색 태그</strong>
                    <span>{(selectedPage.tags ?? []).length}개 태그</span>
                  </button>
                  {detailOpen.tags && (
                    <div className="detail-body tag-editor">
                      <input
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addTagFromDraft();
                        }}
                        placeholder="단어 입력 후 Enter"
                      />
                      {(selectedPage.tags ?? []).length > 0 && (
                        <div className="tag-list">
                          {(selectedPage.tags ?? []).map((tag) => (
                            <span key={tag}>
                              {tag}
                              <button onClick={() => removeTag(tag)} aria-label={`${tag} 태그 삭제`}>
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </article>
          )}
        </section>
      </div>
    </section>
  );
}

function ExportView({ project, onNavigate }: { project: Project; onNavigate: (view: View) => void }) {
  const allPageIds = useMemo(() => new Set(flattenPages(project).map((item) => item.page.id)), [project]);
  const [format, setFormat] = useState<"xlsx" | "md" | "print">("xlsx");
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(allPageIds);
  const selectedCount = selectedPageIds.size;

  useEffect(() => {
    setSelectedPageIds(allPageIds);
  }, [allPageIds]);

  function toggleSection(sectionId: string) {
    const section = project.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const ids = section.pages.map((page) => page.id);
    const allSelected = ids.every((id) => selectedPageIds.has(id));
    setSelectedPageIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function runExport() {
    if (!selectedPageIds.size) return;
    if (format === "xlsx") exportXlsx(project, selectedPageIds);
    if (format === "md") downloadText(`${project.name}.md`, makeMarkdown(project, selectedPageIds), "text/markdown;charset=utf-8");
    if (format === "print") window.print();
  }

  return (
    <section className="screen-wrap export-screen">
      <header className="page-header">
        <div>
          <p className="kicker">Export and print</p>
          <h1>필요한 범위만 골라 바로 내보내기</h1>
          <p className="subcopy">섹션 전체, 선택 페이지, 인쇄용 원고를 같은 구조로 정리합니다.</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => onNavigate("project")}>
            <ArrowLeft size={16} />
            편집
          </button>
          <button className="btn primary" onClick={runExport}>
            <Download size={16} />
            내보내기
          </button>
        </div>
      </header>

      <div className="export-layout">
        <section className="panel pad">
          <p className="kicker">형식</p>
          <div className="format-list">
            <FormatOption
              active={format === "xlsx"}
              icon={<FileSpreadsheet size={21} />}
              title="Excel (.xlsx)"
              text="섹션, 페이지 번호, 제목, 원고 열로 저장"
              onClick={() => setFormat("xlsx")}
            />
            <FormatOption
              active={format === "md"}
              icon={<FileText size={21} />}
              title="Markdown (.md)"
              text="섹션은 제목, 페이지는 소제목으로 정리"
              onClick={() => setFormat("md")}
            />
            <FormatOption
              active={format === "print"}
              icon={<Printer size={21} />}
              title="Print"
              text="브라우저 인쇄 창을 바로 열 수 있는 출력 레이아웃"
              onClick={() => setFormat("print")}
            />
          </div>

          <p className="kicker scope-title">범위</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={selectedPageIds.size === allPageIds.size}
              onChange={() => setSelectedPageIds(selectedPageIds.size === allPageIds.size ? new Set() : allPageIds)}
            />
            전체 프로젝트
          </label>
          {project.sections.map((section) => {
            const sectionIds = section.pages.map((page) => page.id);
            const checked = sectionIds.every((id) => selectedPageIds.has(id));
            return (
              <label className="check-row" key={section.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleSection(section.id)} />
                {section.title.trim() || "구획 없는 노트"}
              </label>
            );
          })}
          <p className="hint">{selectedCount}개 페이지 선택됨</p>
        </section>

        <aside className="print-preview panel">
          <div className="paper">
            <h2>{project.name}</h2>
            {project.sections.map((section) =>
              section.pages
                .filter((page) => selectedPageIds.has(page.id))
                .map((page) => (
                  <section className="print-page" key={page.id}>
                    <b>
                      P.{flattenPages(project).findIndex((item) => item.page.id === page.id) + 1}
                      {section.title.trim() ? ` · ${section.title}` : ""}
                    </b>
                    <h3>{pageWord(page)}</h3>
                    <p>{page.script || "원고 없음"}</p>
                  </section>
                ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function FormatOption({
  active,
  icon,
  title,
  text,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className={`format-option ${active ? "active" : ""}`} onClick={onClick}>
      <span className="file-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </button>
  );
}

function MemosView({
  project,
  onUpdateProject
}: {
  project: Project;
  onUpdateProject: (updater: (project: Project) => Project) => void;
}) {
  const [tab, setTab] = useState<MemoKind>("qa");
  const pagesWithMemos = flattenPages(project).filter((item) => item.page.memo.trim());

  function setProjectMemo(value: string) {
    onUpdateProject((current) => ({
      ...current,
      projectMemos: { ...current.projectMemos, [tab]: value }
    }));
  }

  return (
    <section className="screen-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Memos</p>
          <h1>스크립트와 분리된 발표 보조 노트</h1>
          <p className="subcopy">예상 질문, 주의할 표현, 발표 피드백을 프로젝트 단위와 페이지 단위로 따로 보관합니다.</p>
        </div>
      </header>

      <div className="memo-layout">
        <section className="panel memo-panel">
          <div className="tabs">
            {(Object.keys(memoLabels) as MemoKind[]).map((key) => (
              <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                {memoLabels[key]}
              </button>
            ))}
          </div>
          <div className="memo-editor">
            <textarea value={project.projectMemos[tab]} onChange={(event) => setProjectMemo(event.target.value)} />
            <div className="chips">
              <span>심사위원 질문</span>
              <span>40초 답변</span>
              <span>숫자 근거 확인 필요</span>
            </div>
          </div>
        </section>

        <aside className="panel page-note-panel">
          <p className="kicker">페이지별 메모</p>
          {pagesWithMemos.map((item) => (
            <article className="page-note-card" key={item.page.id}>
              <span className="note-tag">
                P.{flattenPages(project).findIndex((pageItem) => pageItem.page.id === item.page.id) + 1}
              </span>
              <strong>{item.page.title}</strong>
              <p>{item.page.memo}</p>
            </article>
          ))}
          {!pagesWithMemos.length && <p className="hint">페이지 메모가 아직 없습니다.</p>}
        </aside>
      </div>
    </section>
  );
}

function SettingsView({
  settings,
  onSettingsChange
}: {
  settings: UISettings;
  onSettingsChange: (settings: UISettings | ((settings: UISettings) => UISettings)) => void;
}) {
  type SettingsTab = "theme" | "design";
  type DesignPart = "nav" | "category" | "noteTitle" | "noteContent" | "memo" | "link" | "tag";
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("design");
  const [designPart, setDesignPart] = useState<DesignPart>("nav");
  const fontOptions = ["Pretendard", "Arial", "Georgia", "Times New Roman", "Courier New"];
  const designParts: Array<{
    id: DesignPart;
    label: string;
    description: string;
    fontKey: keyof UISettings;
    sizeKey: keyof UISettings;
    colorKey: keyof UISettings;
    backgroundKey?: keyof UISettings;
  }> = [
    {
      id: "nav",
      label: "네비게이션 바",
      description: "제일 좌측 앱 이동 메뉴의 글꼴과 색상입니다.",
      fontKey: "navFontFamily",
      sizeKey: "navTextSize",
      colorKey: "navTextColor"
    },
    {
      id: "category",
      label: "카테고리",
      description: "두 번째 네비게이션의 구획/폴더 제목입니다.",
      fontKey: "categoryFontFamily",
      sizeKey: "categoryTextSize",
      colorKey: "categoryTextColor"
    },
    {
      id: "noteTitle",
      label: "노트제목",
      description: "구획 안에 들어가는 페이지 제목 목록입니다.",
      fontKey: "noteTitleFontFamily",
      sizeKey: "noteTitleTextSize",
      colorKey: "noteTitleTextColor",
      backgroundKey: "noteBackgroundColor"
    },
    {
      id: "noteContent",
      label: "노트내용",
      description: "우측 원고 입력 영역의 본문입니다.",
      fontKey: "noteContentFontFamily",
      sizeKey: "noteContentTextSize",
      colorKey: "noteContentTextColor"
    },
    {
      id: "memo",
      label: "메모",
      description: "페이지 하단 메모 행의 글자와 배경입니다.",
      fontKey: "memoFontFamily",
      sizeKey: "memoTextSize",
      colorKey: "memoTextColor",
      backgroundKey: "memoBackgroundColor"
    },
    {
      id: "link",
      label: "참고링크",
      description: "페이지별 참고 링크 입력 행입니다.",
      fontKey: "linkFontFamily",
      sizeKey: "linkTextSize",
      colorKey: "linkTextColor"
    },
    {
      id: "tag",
      label: "태그",
      description: "검색에 사용되는 고정 태그 칩과 입력창입니다.",
      fontKey: "tagFontFamily",
      sizeKey: "tagTextSize",
      colorKey: "tagTextColor"
    }
  ];
  const activePart = designParts.find((item) => item.id === designPart) ?? designParts[0];
  const sizeValue = Number(settings[activePart.sizeKey]);

  function update(patch: Partial<UISettings>) {
    onSettingsChange((current) => ({ ...current, ...patch }));
  }

  function setTheme(theme: UISettings["theme"]) {
    onSettingsChange((current) => {
      if (current.theme === theme) return current;
      return { ...current, theme };
    });
  }

  return (
    <section className="screen-wrap settings-screen">
      <header className="page-header">
        <div>
          <p className="kicker">Settings</p>
          <h1>작업 환경 설정</h1>
          <p className="subcopy">앱의 기본 글꼴은 Pretendard이며, 각 영역의 글꼴과 색상, 크기를 따로 조정합니다.</p>
        </div>
      </header>

      <div className="settings-tabs">
        <button className={`tab ${settingsTab === "theme" ? "active" : ""}`} onClick={() => setSettingsTab("theme")}>
          테마
        </button>
        <button className={`tab ${settingsTab === "design" ? "active" : ""}`} onClick={() => setSettingsTab("design")}>
          디자인변경
        </button>
      </div>

      {settingsTab === "theme" && (
        <section className="panel pad settings-panel settings-single">
          <p className="kicker">테마</p>
          <div className="setting-row">
            <div>
              <strong>테마</strong>
              <span>상단 전환 버튼과 같은 설정입니다.</span>
            </div>
            <div className="segmented settings-seg">
              <button className={settings.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
                <Sun size={16} />
              </button>
              <button className={settings.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
                <Moon size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {settingsTab === "design" && (
        <div className="design-settings-grid">
          <aside className="panel pad design-part-panel">
            <p className="kicker">파트</p>
            <div className="part-tabs">
              {designParts.map((part) => (
                <button
                  key={part.id}
                  className={designPart === part.id ? "active" : ""}
                  onClick={() => setDesignPart(part.id)}
                >
                  {part.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="panel pad settings-panel">
            <p className="kicker">디자인변경</p>
            <h2>{activePart.label}</h2>
            <p className="hint">{activePart.description}</p>
            <label className="setting-row">
              <div>
                <strong>글꼴</strong>
                <span>{String(settings[activePart.fontKey])}</span>
              </div>
              <select
                className="select-input"
                value={String(settings[activePart.fontKey])}
                onChange={(event) => update({ [activePart.fontKey]: event.target.value } as Partial<UISettings>)}
              >
                {fontOptions.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <div className="setting-row">
              <div>
                <strong>글씨 크기</strong>
                <span>{sizeValue}px</span>
              </div>
              <input
                className="range"
                type="range"
                min={activePart.id === "noteContent" ? "18" : "12"}
                max={activePart.id === "noteContent" ? "36" : "30"}
                value={sizeValue}
                onChange={(event) =>
                  update({ [activePart.sizeKey]: Number(event.target.value) } as Partial<UISettings>)
                }
              />
            </div>
            <label className="setting-row">
              <div>
                <strong>글씨 색상</strong>
                <span>{String(settings[activePart.colorKey])}</span>
              </div>
              <input
                className="color-input"
                type="color"
                value={String(settings[activePart.colorKey])}
                onChange={(event) => update({ [activePart.colorKey]: event.target.value } as Partial<UISettings>)}
              />
            </label>
            {activePart.backgroundKey && (
              <label className="setting-row">
                <div>
                  <strong>배경 색상</strong>
                  <span>{String(settings[activePart.backgroundKey])}</span>
                </div>
                <input
                  className="color-input"
                  type="color"
                  value={String(settings[activePart.backgroundKey])}
                  onChange={(event) =>
                    update({ [activePart.backgroundKey as keyof UISettings]: event.target.value } as Partial<UISettings>)
                  }
                />
              </label>
            )}
            <button className="btn" onClick={() => onSettingsChange(defaultUISettings)}>
              기본값으로 복원
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

function EmojiPicker({
  onPick,
  onClose
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const cat = emojiCategories[tab];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="emoji-picker">
        <div className="ep-title">이모지 선택</div>
        <div className="ep-tabs">
          {emojiCategories.map((c, i) => (
            <button
              key={c.id}
              className={`ep-tab ${i === tab ? "active" : ""}`}
              title={c.label}
              onClick={() => setTab(i)}
            >
              {c.icon}
            </button>
          ))}
        </div>
        <div className="ep-grid" key={cat.id}>
          {cat.list.map((emoji, i) => (
            <button key={`${emoji}-${i}`} onClick={() => { onPick(emoji); onClose(); }} className="ep-btn">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

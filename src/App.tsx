import {
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  FileDown,
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
  Presentation,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  X
} from "lucide-react";
import { CSSProperties, DragEvent, Fragment, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { LabelColor, MemoKind, Project, ProjectKind, ScriptPage, ScriptSection, View } from "./types";
import {
  countNotes,
  downloadText,
  estimateSeconds,
  exportXlsx,
  flattenPages,
  formatDate,
  formatDuration,
  isCoverPage,
  isMemoPage,
  makeMarkdown,
  makePrintHtml,
  pageNumbers,
  pageWord,
  projectChildren,
  scopePageIds
} from "./utils";
import type { ExportScope } from "./utils";
import { mergeRichText, richTextPlain } from "./richText";
import { RichTextEditor } from "./editor/RichTextEditor";

/** Sections with an empty title are implicit containers: their notes render
 *  directly under the project without a divider row. */
function isDividerSection(section: ScriptSection) {
  return section.title.trim() !== "";
}

// 메모 섹션(제목이 "메모")은 항상 프로젝트 맨 뒤에 있어야 한다.
// 섹션을 새로 만든 뒤 호출해 메모 섹션을 뒤로 보낸다(상대 순서는 유지).
function moveMemoSectionsToEnd(sections: ScriptSection[]): ScriptSection[] {
  const memoSections = sections.filter((section) => section.title.trim() === "메모");
  if (memoSections.length === 0) return sections;
  const rest = sections.filter((section) => section.title.trim() !== "메모");
  if (rest.length === 0) return sections;
  return [...rest, ...memoSections];
}

const UI_STORAGE_KEY = "pt-script-manager-ui-v1";
const EXPANDED_STORAGE_KEY = "pt-script-manager-expanded-v1";

function loadExpandedProjectIds(): Set<Id<"projects">> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is Id<"projects"> => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

type EmojiCategory = { id: string; label: string; icon: string; list: string[] };

const emojiCategories: EmojiCategory[] = [
  {
    id: "study",
    label: "문서·사무",
    icon: "📁",
    list: [
      "📁", "📂", "🗂️", "🗃️", "📦", "📚", "📖", "📕", "📗", "📘",
      "📙", "📔", "📓", "📒", "📑", "📄", "📃", "📜", "📰", "🗞️",
      "📝", "✏️", "🖊️", "🖋️", "🖍️", "✒️", "🖌️", "📌", "📍", "🔖",
      "📎", "🖇️", "📐", "📏", "✂️", "📋", "💼", "💻", "⌨️", "🖥️",
      "🖨️", "🖱️", "📈", "📉", "📊", "🎯", "📮", "✉️", "📧", "📥",
      "📤", "🗄️", "📆", "📅", "🗓️", "🗒️", "🕰️", "🧭", "⚖️", "⚙️",
      "🔑", "🔐", "🔒", "🔓"
    ]
  },
  {
    id: "smiley",
    label: "표정·사람",
    icon: "😀",
    list: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
      "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸",
      "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️",
      "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡",
      "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓",
      "🤗", "🤔", "🫣", "🤭", "🤫", "🤥", "😶", "😶‍🌫️", "😐", "😑",
      "😬", "🫨", "🫠", "🙋", "🙋‍♂️", "🙋‍♀️", "🙌", "👏", "👍", "👎",
      "👊", "✊", "🤛", "🤜", "🤞", "🤟", "🤘", "👌", "🤌", "🤏",
      "👈", "👉", "👆", "👇", "🖕", "✍️", "🤳", "💅", "🤝", "🙏"
    ]
  },
  {
    id: "animal",
    label: "동물",
    icon: "🐶",
    list: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆",
      "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛",
      "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢",
      "🐍", "🦎", "🐙", "🦑", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬",
      "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘",
      "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐑",
      "🐐", "🦌", "🐕", "🐩", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢",
      "🦩", "🕊️", "🐇", "🦝", "🦡", "🐿️", "🦫", "🦔"
    ]
  },
  {
    id: "nature",
    label: "자연·날씨",
    icon: "🌿",
    list: [
      "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍",
      "🍃", "🍂", "🍁", "🌾", "🌺", "🌸", "🌼", "🌻", "🌷", "🌹",
      "🪴", "🍄", "🐚", "🪨", "🌾", "🌅", "🌅", "🌅", "☀️", "🌤️",
      "⛅", "🌥️", "☁️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "💨", "🌪️",
      "🌫️", "🌈", "🌊", "🌋", "☄️", "🪐", "🌟", "✨", "🌍", "🌕",
      "🌛", "🌜", "🌙", "💥", "🔥", "💧", "⚡"
    ]
  },
  {
    id: "food",
    label: "음식·음료",
    icon: "🍎",
    list: [
      "🍎", "🍏", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦",
      "🥬", "🥒", "🌶️", "🌽", "🥕", "🫑", "🥔", "🍠", "🥐", "🍞",
      "🥖", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓",
      "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫓", "🥙", "🧆",
      "🍳", "🥘", "🍲", "🫕", "🥫", "🍿", "🥟", "🍱",
      "🍣", "🍤", "🍙", "🍚", "🍛", "🍜", "🍝", "🍢", "🍘", "🍥",
      "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🍰", "🎂", "🍮",
      "🍭", "🍬", "🍫", "🍩", "🍪", "🍯", "🥛", "☕", "🍵", "🥤",
      "🧃", "🧉", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂"
    ]
  },
  {
    id: "activity",
    label: "활동·취미",
    icon: "⚽",
    list: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
      "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "🪁",
      "🏹", "🎣", "🤿", "🥊", "🥋", "🛹", "🛼", "🚴", "🏋️", "🧗",
      "🏂", "⛷️", "🚣", "🏊", "🏄", "🏇", "🎮",
      "🕹️", "🎰", "🎲", "🧩", "🎳", "🎭", "🎨", "🎬", "🎤", "🎧",
      "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🎻", "🪕", "🎫", "🎟️",
      "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "🎪", "🧵", "🧶", "♟️",
      "🎯"
    ]
  },
  {
    id: "transport",
    label: "이동수단",
    icon: "🚗",
    list: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
      "🚚", "🚛", "🚜", "🛴", "🚲", "🛵", "🏍️", "🚨", "🚔", "🚍",
      "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚄", "🚅", "🚆",
      "🚇", "🛩️", "🛫", "✈️", "🚀", "🛸", "🚁", "⛵", "🛶", "🚤",
      "🚢", "⚓", "🚂", "🚈", "🚝", "🚞", "🛻", "🛺", "🛳️", "⛴️",
      "🛬", "🛩️", "🛰️"
    ]
  },
  {
    id: "place",
    label: "건물·장소",
    icon: "🏠",
    list: [
      "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠",
      "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️",
      "🛖", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩",
      "🏪", "🏫", "🏭", "⛪", "🕌", "🕍", "⛩️", "🕋", "🏬", "🏙️",
      "🏘️", "💒", "🌌", "🌉", "🌁"
    ]
  },
  {
    id: "heart",
    label: "하트·기타",
    icon: "❤️",
    list: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❤️‍🔥",
      "❤️‍🩹", "🫀", "🫁", "💌", "💤", "💢", "💣", "💥", "💨", "💫",
      "💬", "💭", "🗯️", "💡", "⚡", "🌟", "✨"
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
  pageNumFontFamily: string;
  pageNumTextSize: number;
  pageNumTextColor: string;
  noteContentFontFamily: string;
  noteContentTextSize: number;
  noteContentTextColor: string;
  combinedTitleFontFamily: string;
  combinedTitleTextSize: number;
  combinedTitleTextColor: string;
  combinedContentFontFamily: string;
  combinedContentTextSize: number;
  combinedContentTextColor: string;
  memoFontFamily: string;
  memoTextSize: number;
  memoTextColor: string;
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
  pageNumFontFamily: "Pretendard",
  pageNumTextSize: 11,
  pageNumTextColor: "#0d9488",
  noteContentFontFamily: "Pretendard",
  noteContentTextSize: 23,
  noteContentTextColor: "#111827",
  combinedTitleFontFamily: "Pretendard",
  combinedTitleTextSize: 20,
  combinedTitleTextColor: "#111827",
  combinedContentFontFamily: "Pretendard",
  combinedContentTextSize: 19,
  combinedContentTextColor: "#111827",
  memoFontFamily: "Pretendard",
  memoTextSize: 17,
  memoTextColor: "#667085",
  linkFontFamily: "Pretendard",
  linkTextSize: 17,
  linkTextColor: "#667085",
  tagFontFamily: "Pretendard",
  tagTextSize: 16,
  tagTextColor: "#667085"
};

const SIDEBAR_MIN_WIDTH = 196;
const SIDEBAR_MAX_WIDTH = 640;

const darkStyleDefaults = {
  navTextColor: "#d8dee8",
  categoryTextColor: "#a8b3c2",
  noteTitleTextColor: "#f8fafc",
  pageNumTextColor: "#2dd4bf",
  noteContentTextColor: "#f8fafc",
  combinedTitleTextColor: "#f8fafc",
  combinedContentTextColor: "#e2e8f0",
  memoTextColor: "#d1d8e0",
  linkTextColor: "#9fb5d4",
  tagTextColor: "#d1d8e0"
};

const memoLabels: Record<MemoKind, string> = {
  qa: "예상 Q&A",
  caution: "주의 사항",
  feedback: "피드백"
};

const memoPageSplitPrefix = "__PT_MEMO_PAGE_SPLIT_V1__";

function decodeMemoPageColumns(value: string) {
  if (!value.startsWith(memoPageSplitPrefix)) return [value];
  try {
    const columns = JSON.parse(value.slice(memoPageSplitPrefix.length));
    return Array.isArray(columns) && columns.length > 0 && columns.every((column) => typeof column === "string")
      ? columns.slice(0, 4)
      : [value];
  } catch {
    return [value];
  }
}

function encodeMemoPageColumns(columns: string[]) {
  return columns.length === 1 ? columns[0] : `${memoPageSplitPrefix}${JSON.stringify(columns)}`;
}

function equalMemoColumnWidths(count: number) {
  return Array.from({ length: count }, () => 100 / count);
}

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
      pageNumFontFamily: parsed.pageNumFontFamily ?? defaultUISettings.pageNumFontFamily,
      pageNumTextSize: parsed.pageNumTextSize ?? defaultUISettings.pageNumTextSize,
      pageNumTextColor: parsed.pageNumTextColor ?? defaultUISettings.pageNumTextColor,
      noteContentFontFamily: parsed.noteContentFontFamily ?? defaultUISettings.noteContentFontFamily,
      noteContentTextSize: parsed.noteContentTextSize ?? defaultUISettings.noteContentTextSize,
      noteContentTextColor: parsed.noteContentTextColor ?? defaultUISettings.noteContentTextColor,
      combinedTitleFontFamily: parsed.combinedTitleFontFamily ?? defaultUISettings.combinedTitleFontFamily,
      combinedTitleTextSize: parsed.combinedTitleTextSize ?? defaultUISettings.combinedTitleTextSize,
      combinedTitleTextColor: parsed.combinedTitleTextColor ?? defaultUISettings.combinedTitleTextColor,
      combinedContentFontFamily: parsed.combinedContentFontFamily ?? defaultUISettings.combinedContentFontFamily,
      combinedContentTextSize: parsed.combinedContentTextSize ?? defaultUISettings.combinedContentTextSize,
      combinedContentTextColor: parsed.combinedContentTextColor ?? defaultUISettings.combinedContentTextColor,
      memoFontFamily: parsed.memoFontFamily ?? defaultUISettings.memoFontFamily,
      memoTextSize: parsed.memoTextSize ?? parsed.pageMemoTextSize ?? defaultUISettings.memoTextSize,
      memoTextColor: parsed.memoTextColor ?? parsed.pageMemoTextColor ?? defaultUISettings.memoTextColor,
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

// 원고 저장 디바운스. 키 입력마다 patch를 보내면 편집 1회가 (뮤테이션 1회 +
// 구독 쿼리 재실행 × 전체 원고 읽기)로 증폭돼 Convex Database I/O가 폭증한다.
const SAVE_DEBOUNCE_MS = 1000;
// 연속 타이핑 중에도 이 시간을 넘기면 강제로 저장한다.
const SAVE_MAX_WAIT_MS = 5000;

export default function App() {
  const [view, setView] = useState<View>("home");
  const projectsQuery = useQuery(api.projects.list);
  // 휴지통 목록은 휴지통 화면에서만 구독한다. 상시 구독하면 모든 patch마다
  // 이 쿼리도 재실행되어 읽기 I/O가 두 배로 나간다.
  const trashQuery = useQuery(api.projects.listTrash, view === "trash" ? {} : "skip");
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
          ? {
              ...doc,
              // Only override fields the caller actually sent, matching the
              // mutation's per-field patch (avoids clobbering the other field).
              ...(args.sections !== undefined ? { sections: args.sections } : {}),
              ...(args.projectMemos !== undefined ? { projectMemos: args.projectMemos } : {}),
              updatedAt: new Date().toISOString()
            }
          : doc
      )
    );
  });
  const reorderProjectsMutation = useMutation(api.projects.reorderProjects);
  const flattenHierarchyMutation = useMutation(api.projects.flattenHierarchy);
  const seedIfEmptyMutation = useMutation(api.projects.seedIfEmpty);

  // 저장 대기 중인 sections. UI가 이 값을 서버 값보다 우선 사용하므로 타이핑은
  // 즉시 화면에 반영되고, 서버 저장만 디바운스된다.
  const pendingSectionsRef = useRef<Map<Id<"projects">, ScriptSection[]>>(new Map());
  // ref 내용이 바뀌었음을 useMemo에 알리는 카운터.
  const [pendingVersion, setPendingVersion] = useState(0);
  const saveTimerRef = useRef<number | null>(null);
  const firstPendingAtRef = useRef<number | null>(null);

  function flushPendingSections() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    firstPendingAtRef.current = null;
    if (pendingSectionsRef.current.size === 0) return;
    const entries = [...pendingSectionsRef.current.entries()];
    pendingSectionsRef.current.clear();
    // patch의 optimistic update가 로컬 쿼리 결과에 동기로 반영되므로 pending을
    // 비워도 화면이 이전 값으로 되돌아가지 않는다.
    for (const [id, sections] of entries) {
      patchProjectMutation({ id, sections });
    }
    setPendingVersion((version) => version + 1);
  }

  const flushRef = useRef(flushPendingSections);
  flushRef.current = flushPendingSections;

  function queueSectionsSave(projectId: Id<"projects">, sections: ScriptSection[]) {
    pendingSectionsRef.current.set(projectId, sections);
    setPendingVersion((version) => version + 1);
    const now = Date.now();
    if (firstPendingAtRef.current === null) firstPendingAtRef.current = now;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const waited = now - firstPendingAtRef.current;
    const delay = Math.min(SAVE_DEBOUNCE_MS, Math.max(0, SAVE_MAX_WAIT_MS - waited));
    saveTimerRef.current = window.setTimeout(() => flushRef.current(), delay);
  }

  // 탭을 닫거나 백그라운드로 보낼 때 대기 중인 편집을 즉시 저장한다.
  useEffect(() => {
    const flush = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const projects: Project[] = useMemo(
    () =>
      (projectsQuery ?? []).map((doc) => {
        const mapped = mapProjectDoc(doc);
        const pending = pendingSectionsRef.current.get(doc._id);
        return pending ? { ...mapped, sections: pending } : mapped;
      }),
    // pendingVersion은 pendingSectionsRef가 바뀔 때마다 증가한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectsQuery, pendingVersion]
  );
  const trashedProjects: Project[] = useMemo(() => (trashQuery ?? []).map(mapProjectDoc), [trashQuery]);

  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | "">("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [uiSettings, setUISettings] = useState<UISettings>(loadUISettings);
  const [resizingNav, setResizingNav] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<Id<"projects">>>(loadExpandedProjectIds);
  const [createOpen, setCreateOpen] = useState(false);
  // Project targeted by the export modal (opened from the tree context menu or
  // the project landing card). Null = modal closed.
  const [exportTarget, setExportTarget] = useState<Project | null>(null);
  const [autoRenameId, setAutoRenameId] = useState<Id<"projects"> | null>(null);
  const migrationRequested = useRef(false);

  // Memo unsaved changes tracking
  const [memoDirty, setMemoDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const memoSaveRef = useRef<(() => void) | null>(null);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];

  function navigateFromMemo(action: () => void) {
    if (view === "memos" && memoDirty) {
      setPendingAction(() => action);
      return;
    }
    action();
  }

  function handleMemoSaveAndProceed() {
    memoSaveRef.current?.();
    setMemoDirty(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  function handleMemoDiscardAndProceed() {
    setMemoDirty(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  function addPage(sectionId?: string) {
    const proj = activeProject;
    if (!proj) return;
    // Default to the section that holds the currently-selected page so a new
    // note lands next to what the user is working on; fall back to the first.
    const selectedSectionId = selectedPageId
      ? proj.sections.find((section) => section.pages.some((page) => page.id === selectedPageId))?.id
      : undefined;
    const targetSectionId = sectionId ?? selectedSectionId ?? proj.sections[0]?.id;
    const page: ScriptPage = {
      id: uid("page"),
      title: "새 노트",
      script: "",
      memo: "",
      referenceLinks: [],
      tags: []
    };
    updateProject(proj.id, (current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === targetSectionId ? { ...section, pages: [...section.pages, page] } : section
      )
    }));
    setSelectedPageId(page.id);
  }

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
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expandedProjectIds]));
  }, [expandedProjectIds]);

  useEffect(() => {
    if (!resizingNav) return undefined;
    function onMove(event: globalThis.MouseEvent) {
      setUISettings((current) => ({
        ...current,
        navCollapsed: false,
        sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, event.clientX))
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
    if (selectedPageId) {
      const pages = flattenPages(activeProject);
      if (!pages.some((item) => item.page.id === selectedPageId)) {
        setSelectedPageId("");
      }
    }
  }, [activeProject, selectedPageId]);

  // Section edits only ever touch `sections`. Sending just that field means a
  // section edit can never clobber a concurrently-saved projectMemos value.
  function updateProject(projectId: Id<"projects">, updater: (project: Project) => Project) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const next = updater(project);
    queueSectionsSave(projectId, next.sections);
  }

  // Dedicated path for saving project-level memos: sends only projectMemos.
  function updateProjectMemos(projectId: Id<"projects">, projectMemos: Record<MemoKind, string>) {
    patchProjectMutation({ id: projectId, projectMemos });
  }

  function openProject(projectId: Id<"projects">) {
    setActiveProjectId(projectId);
    setSelectedPageId("");
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function doOpenPage(projectId: Id<"projects">, pageId: string) {
    // pending에 방금 큐된 편집(예: 노트 추가)이 있으면 그것이 최신이다.
    // stale한 projects 클로저로 덮어쓰면 방금 추가한 노트가 사라진다.
    const baseSections =
      pendingSectionsRef.current.get(projectId) ?? projects.find((item) => item.id === projectId)?.sections;
    if (baseSections) {
      const sections = baseSections.map((section) => ({
        ...section,
        collapsed: section.pages.some((page) => page.id === pageId) ? false : section.collapsed
      }));
      queueSectionsSave(projectId, sections);
    }
    setActiveProjectId(projectId);
    setSelectedPageId(pageId);
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function openSearchResult(projectId: Id<"projects">, pageId: string) {
    navigateFromMemo(() => doOpenPage(projectId, pageId));
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
    queueSectionsSave(projectId, sections);
    setActiveProjectId(projectId);
    setSelectedPageId(page.id);
    setView("project");
    setExpandedProjectIds((current) => new Set(current).add(projectId));
  }

  function handleMoveProject(orderedIds: Id<"projects">[]) {
    reorderProjectsMutation({ orderedIds });
  }

  function handleDeleteProject(id: Id<"projects">) {
    // 대기 중인 편집을 먼저 저장해 휴지통에서 복원해도 내용이 유지되게 한다.
    flushPendingSections();
    removeProjectMutation({ id });
  }

  function handleRestoreProject(id: Id<"projects">) {
    restoreProjectMutation({ id });
  }

  function handlePermanentlyDeleteProject(id: Id<"projects">) {
    // 곧 사라질 문서에 대한 대기 저장은 버린다 (patch가 없는 id로 나가면 에러).
    pendingSectionsRef.current.delete(id);
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
    "--page-num-font-family": uiSettings.pageNumFontFamily,
    "--page-num-text-size": `${uiSettings.pageNumTextSize}px`,
    "--page-num-text-color": themedColor(
      uiSettings.pageNumTextColor,
      defaultUISettings.pageNumTextColor,
      darkStyleDefaults.pageNumTextColor
    ),
    "--note-content-font-family": uiSettings.noteContentFontFamily,
    "--note-content-text-size": `${uiSettings.noteContentTextSize}px`,
    "--note-content-text-color": themedColor(
      uiSettings.noteContentTextColor,
      defaultUISettings.noteContentTextColor,
      darkStyleDefaults.noteContentTextColor
    ),
    "--combined-title-font-family": uiSettings.combinedTitleFontFamily,
    "--combined-title-text-size": `${uiSettings.combinedTitleTextSize}px`,
    "--combined-title-text-color": themedColor(
      uiSettings.combinedTitleTextColor,
      defaultUISettings.combinedTitleTextColor,
      darkStyleDefaults.combinedTitleTextColor
    ),
    "--combined-content-font-family": uiSettings.combinedContentFontFamily,
    "--combined-content-text-size": `${uiSettings.combinedContentTextSize}px`,
    "--combined-content-text-color": themedColor(
      uiSettings.combinedContentTextColor,
      defaultUISettings.combinedContentTextColor,
      darkStyleDefaults.combinedContentTextColor
    ),
    "--memo-font-family": uiSettings.memoFontFamily,
    "--memo-text-size": `${uiSettings.memoTextSize}px`,
    "--memo-text-color": themedColor(
      uiSettings.memoTextColor,
      defaultUISettings.memoTextColor,
      darkStyleDefaults.memoTextColor
    ),
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
      <Sidebar
        view={view}
        settings={uiSettings}
        onSettingsChange={setUISettings}
        onNavigate={(v) => navigateFromMemo(() => setView(v))}
        onResizeStart={() => setResizingNav(true)}
        projects={projects}
        activeProjectId={activeProject.id}
        selectedPageId={selectedPageId}
        expandedProjectIds={expandedProjectIds}
        onToggleProjectExpanded={toggleProjectExpanded}
        onToggleAllExpanded={toggleAllExpanded}
        onToggleTreeSection={toggleTreeSection}
        onUpdateProject={updateProject}
        onOpenProject={(id) => navigateFromMemo(() => openProject(id))}
        onSelectTreePage={openSearchResult}
        onMoveProject={handleMoveProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onQuickCreateProject={quickCreateProject}
        onAddNote={addNoteToProject}
        onEmojiChange={handleEmojiChange}
        onExportProject={setExportTarget}
        autoRenameId={autoRenameId}
        onAutoRenameConsumed={() => setAutoRenameId(null)}
      />
      <main className="main-area">
        <div className="main-top-bar">
          <GlobalSearch projects={projects} onOpenResult={openSearchResult} />
          <div className="top-settings-bar">
            {view === "home" && (
              <>
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
              </>
            )}
            <button
              className={`corner-icon-btn ${view === "settings" ? "active" : ""}`}
              onClick={() => navigateFromMemo(() => setView("settings"))}
              aria-label="설정"
              title="설정"
            >
              <Settings size={17} />
            </button>
            <button
              className={`corner-icon-btn ${view === "trash" ? "active" : ""}`}
              onClick={() => navigateFromMemo(() => setView("trash"))}
              aria-label="휴지통"
              title="휴지통"
            >
              <Trash2 size={17} />
            </button>
            <button
              className="corner-icon-btn"
              onClick={toggleTheme}
              aria-label={uiSettings.theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
            >
              {uiSettings.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </div>
        {view === "home" && (
          <Home
            projects={projects}
            onRequestCreate={() => setCreateOpen(true)}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onToggleFavorite={handleToggleFavorite}
            onOpenProject={(id) => navigateFromMemo(() => openProject(id))}
            onOpenPage={(projectId, pageId) => openSearchResult(projectId, pageId)}
            onSelectProject={setActiveProjectId}
            activeProjectId={activeProjectId}
            expandedProjectIds={expandedProjectIds}
            onToggleProjectExpanded={toggleProjectExpanded}
            sort={sort}
            mode={mode}
          />
        )}
        {view === "project" && (
          <ProjectDetail
            project={activeProject}
            selectedPageId={selectedPageId}
            onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
            onNavigate={setView}
            onAddPage={addPage}
            onExport={() => setExportTarget(activeProject)}
          />
        )}
        {view === "memos" && (
          <MemosView
            project={activeProject}
            onSaveMemos={(memos) => updateProjectMemos(activeProject.id, memos)}
            onNavigate={(v: View) => navigateFromMemo(() => setView(v))}
            onDirtyChange={setMemoDirty}
            saveRef={memoSaveRef}
          />
        )}
        {pendingAction && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" style={{ maxWidth: 380, padding: "24px" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>저장되지 않은 변경사항</h2>
              <p style={{ color: "var(--muted)", marginBottom: "20px" }}>메모가 저장되지 않았습니다. 저장하시겠습니까?</p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button className="btn" onClick={handleMemoDiscardAndProceed}>
                  저장하지 않고 이동
                </button>
                <button className="btn primary" onClick={handleMemoSaveAndProceed}>
                  저장 후 이동
                </button>
              </div>
            </div>
          </div>
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
      {exportTarget && <ExportModal project={exportTarget} onClose={() => setExportTarget(null)} />}
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

function NavTreePageButton({
  page,
  pageNum,
  selected,
  dropClass,
  onSelect,
  onToggleMemo,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onContextMenu
}: {
  page: ScriptPage;
  pageNum: number | undefined;
  selected: boolean;
  dropClass: string;
  onSelect: () => void;
  onToggleMemo: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  // The row is always `draggable`, so grabbing anywhere on it starts a drag.
  // The trouble is that Chromium hijacks even the tiniest pointer movement into
  // a drag gesture, and its drag-start judgement (TryStartDrag) fires effectively
  // once per gesture -- so arming the drag late (after a threshold move) never
  // starts a drag for the current gesture. Being always draggable also lets the
  // browser swallow the dblclick that toggles note <-> memo, because the second
  // mousedown of a double-click gets reinterpreted as the start of a drag.
  //
  // The guard below fixes that: we remember the last click, and if a dragstart
  // fires right after a click at nearly the same spot (i.e. the second press of
  // a double-click), we `preventDefault()` it so the native dblclick survives.
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);

  return (
    <button
      type="button"
      className={`nav-tree-page ${isMemoPage(page) ? "memo-page" : ""} ${isCoverPage(page) ? "cover-page" : ""} ${selected ? "active" : ""} ${dropClass}`}
      onClick={(event) => {
        lastClickRef.current = { time: Date.now(), x: event.clientX, y: event.clientY };
        onSelect();
      }}
      onDoubleClick={onToggleMemo}
      title={pageWord(page)}
      draggable
      onDragStart={(event) => {
        const last = lastClickRef.current;
        // A dragstart within 400ms and near the last click is the second press
        // of a double-click. Cancel it so dblclick (note <-> memo toggle) works.
        if (
          last &&
          Date.now() - last.time < 400 &&
          Math.abs(event.clientX - last.x) + Math.abs(event.clientY - last.y) < 10
        ) {
          event.preventDefault();
          return;
        }
        onDragStart(event);
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
    >
      <span className="tree-grip-handle" draggable>
        <GripVertical size={13} className="tree-grip" />
      </span>
      {isMemoPage(page) ? (
        <span className="tree-page-num" aria-label="메모" />
      ) : (
        <span className="tree-page-num">P.{pageNum}</span>
      )}
      <span className="tree-page-title">{pageWord(page)}</span>
    </button>
  );
}

function NavProjectNode({ project, ctx }: { project: Project; ctx: NavCtx }) {
  const expanded = ctx.expandedProjectIds.has(project.id);
  // Global page numbers (memo pages excluded), shared by both section renderers.
  const pageNumberMap = pageNumbers(project);
  const isActive = project.id === ctx.activeProjectId && (ctx.view === "project" || ctx.view === "memos");
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
    isMemo?: boolean;
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
    const title = window.prompt("섹션 이름", current?.title ?? "");
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

  function deleteSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "section") return;
    const sectionId = itemMenu.sectionId;
    if (project.sections.length <= 1) return;
    const section = project.sections.find((item) => item.id === sectionId);
    if (!section) return;
    setItemMenu(null);
    const hasContent = section.pages.some((page) =>
      [page.title, page.script, page.memo, ...(page.referenceLinks ?? []), ...(page.tags ?? [])].some((value) => value.trim())
    );
    const message = hasContent
      ? `"${section.title}" 섹션 안에 작성된 노트가 있습니다. 섹션과 포함된 노트를 삭제할까요?`
      : `"${section.title}" 섹션을 삭제할까요?`;
    if (!window.confirm(message)) return;
    
    ctx.onUpdateProject(project.id, (current) => ({
      ...current,
      sections: current.sections.filter((item) => item.id !== sectionId)
    }));
    
    const flatPages = project.sections.flatMap((s) => s.pages);
    const remainingPages = flatPages.filter((page) => !section.pages.some((sp) => sp.id === page.id));
    if (section.pages.some((page) => page.id === ctx.selectedPageId)) {
      ctx.onSelectTreePage(project.id, remainingPages[0]?.id ?? "");
    }
  }

  function addNoteToSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "section") return;
    const sectionId = itemMenu.sectionId;
    setItemMenu(null);
    const page: ScriptPage = {
      id: uid("page"),
      title: "새 노트",
      script: "",
      memo: "",
      referenceLinks: [],
      tags: []
    };
    ctx.onUpdateProject(project.id, (current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, pages: [...section.pages, page] } : section
      )
    }));
    ctx.onSelectTreePage(project.id, page.id);
  }

  // Insert a divider right above the clicked note: it and the notes after it
  // move into a new section.
  function splitSectionFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    const { sectionId, pageId } = itemMenu;
    setItemMenu(null);
    const title = window.prompt("새 섹션 이름", "새 섹션");
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
      return { ...proj, sections: moveMemoSectionsToEnd(sections) };
    });
  }

  // Flip a note between note and memo. The current value is read from the live
  // project so the label/behavior always matches the stored flag.
  // 노트 → 메모 전환 시에는 항상 프로젝트 마지막의 "메모" 섹션으로 이동한다
  // (없으면 맨 뒤에 새로 만들고, 있으면 그 섹션의 맨 뒤에 붙인다).
  function togglePageMemo(sectionId: string, pageId: string) {
    ctx.onUpdateProject(project.id, (current) => {
      const sourceSection = current.sections.find((section) => section.id === sectionId);
      const page = sourceSection?.pages.find((item) => item.id === pageId);
      if (!page) return current;

      if (isMemoPage(page)) {
        // 메모 → 노트: 자리 이동 없이 플래그만 되돌린다.
        return {
          ...current,
          sections: current.sections.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  pages: section.pages.map((item) => (item.id === pageId ? { ...item, isMemo: false } : item))
                }
              : section
          )
        };
      }

      const memoPage: ScriptPage = { ...page, isMemo: true };
      const withoutPage = current.sections.map((section) =>
        section.id === sectionId
          ? { ...section, pages: section.pages.filter((item) => item.id !== pageId) }
          : section
      );
      const memoSection = withoutPage.find((section) => section.title.trim() === "메모");
      if (memoSection) {
        return {
          ...current,
          sections: withoutPage.map((section) =>
            section.id === memoSection.id ? { ...section, pages: [...section.pages, memoPage] } : section
          )
        };
      }
      return {
        ...current,
        sections: [...withoutPage, { id: uid("section"), title: "메모", collapsed: false, pages: [memoPage] }]
      };
    });
  }

  // 갑지 토글: 트리 행의 시각 효과만 바뀌고 페이지 번호는 그대로 유지된다.
  function togglePageCover(sectionId: string, pageId: string) {
    ctx.onUpdateProject(project.id, (current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              pages: section.pages.map((page) =>
                page.id === pageId ? { ...page, isCover: !isCoverPage(page) } : page
              )
            }
          : section
      )
    }));
  }

  function toggleCoverFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    const { sectionId, pageId } = itemMenu;
    setItemMenu(null);
    togglePageCover(sectionId, pageId);
  }

  function deletePageFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    const targetPage = project.sections
      .flatMap((section) => section.pages)
      .find((page) => page.id === itemMenu.pageId);
    setConfirmDeletePage({
      sectionId: itemMenu.sectionId,
      pageId: itemMenu.pageId,
      label: itemMenu.label,
      isMemo: targetPage ? isMemoPage(targetPage) : false
    });
    setItemMenu(null);
  }

  // Insert a note immediately after the right-clicked page in the same section.
  function insertPageAfterFromMenu() {
    if (!itemMenu || itemMenu.type !== "page" || !itemMenu.pageId) return;
    const { sectionId, pageId } = itemMenu;
    setItemMenu(null);
    const page: ScriptPage = {
      id: uid("page"),
      title: "새 노트",
      script: "",
      memo: "",
      referenceLinks: [],
      tags: []
    };
    ctx.onUpdateProject(project.id, (current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const index = section.pages.findIndex((item) => item.id === pageId);
        if (index < 0) return { ...section, pages: [...section.pages, page] };
        const pages = [...section.pages];
        pages.splice(index + 1, 0, page);
        return { ...section, pages };
      })
    }));
    ctx.onSelectTreePage(project.id, page.id);
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

  // Whether the page targeted by the open context menu is currently a memo.
  const menuTargetPage =
    itemMenu?.type === "page" && itemMenu.pageId
      ? project.sections.flatMap((section) => section.pages).find((page) => page.id === itemMenu.pageId)
      : undefined;
  const menuTargetIsCover = menuTargetPage ? isCoverPage(menuTargetPage) : false;
  const menuTargetIsMemo = menuTargetPage ? isMemoPage(menuTargetPage) : false;

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
        <button
          type="button"
          className="tree-caret"
          onClick={(event) => {
            event.stopPropagation();
            ctx.onToggleProjectExpanded(project.id);
          }}
          aria-label={expanded ? "접기" : "펼치기"}
          title={expanded ? "접기" : "펼치기"}
          aria-expanded={expanded}
        >
          <ChevronDown size={20} className={expanded ? "" : "rotated"} />
        </button>
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
          <Plus size={18} />
        </button>
      </div>

      {expanded && (
        <div className="nav-children">
          {/* 섹션은 데이터 순서 그대로 렌더링한다(페이지 번호 순서와 일치).
              제목 없는(암시적) 섹션은 구분 행 없이 페이지만 보여준다. */}
          {project.sections.map((section) => {
            if (!isDividerSection(section)) {
              if (section.pages.length === 0) return null;
              return (
                <div className="nav-page-list implicit" key={section.id}>
                  {section.pages.map((page) => {
                    return (
                      <NavTreePageButton
                        key={page.id}
                        page={page}
                        pageNum={pageNumberMap.get(page.id)}
                        selected={isActive && page.id === ctx.selectedPageId}
                        dropClass={treeDrop?.key === `page:${page.id}` ? `drop-${treeDrop.mode}` : ""}
                        onSelect={() => ctx.onSelectTreePage(project.id, page.id)}
                        onToggleMemo={() => togglePageMemo(section.id, page.id)}
                        onDragStart={(event) =>
                          onTreeItemDragStart({ type: "page", sectionId: section.id, pageId: page.id }, event)
                        }
                        onDragOver={(event) => onPageDragOver(page.id, event)}
                        onDrop={(event) => onPageDrop(section.id, page.id, event)}
                        onDragEnd={onTreeDragEnd}
                        onContextMenu={(event) => onPageContextMenu(section, page, event)}
                      />
                    );
                  })}
                </div>
              );
            }
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
                {!section.collapsed && (
                  <div className="nav-page-list">
                    {section.pages.map((page) => {
                      return (
                        <NavTreePageButton
                          key={page.id}
                          page={page}
                          pageNum={pageNumberMap.get(page.id)}
                          selected={isActive && page.id === ctx.selectedPageId}
                          dropClass={treeDrop?.key === `page:${page.id}` ? `drop-${treeDrop.mode}` : ""}
                          onSelect={() => ctx.onSelectTreePage(project.id, page.id)}
                          onToggleMemo={() => togglePageMemo(section.id, page.id)}
                          onDragStart={(event) =>
                            onTreeItemDragStart({ type: "page", sectionId: section.id, pageId: page.id }, event)
                          }
                          onDragOver={(event) => onPageDragOver(page.id, event)}
                          onDrop={(event) => onPageDrop(section.id, page.id, event)}
                          onDragEnd={onTreeDragEnd}
                          onContextMenu={(event) => onPageContextMenu(section, page, event)}
                        />
                      );
                    })}
                  </div>
                )}
              </Fragment>
            );
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
              left: Math.max(8, Math.min(itemMenu.x, window.innerWidth - 188 - 8)),
              top: Math.max(
                8,
                Math.min(itemMenu.y, window.innerHeight - (itemMenu.type === "page" ? (menuTargetIsMemo ? 150 : 185) : 160) - 8)
              )
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {itemMenu.type === "section" ? (
              <>
                <button type="button" role="menuitem" className="context-menu-item" onClick={renameSectionFromMenu}>
                  <Pencil size={14} />
                  섹션 이름 변경
                </button>
                <button type="button" role="menuitem" className="context-menu-item" onClick={addNoteToSectionFromMenu}>
                  <Plus size={14} />
                  여기에 노트 추가
                </button>
                <button type="button" role="menuitem" className="context-menu-item" onClick={dissolveSectionFromMenu}>
                  <Trash2 size={14} />
                  섹션 해제 (노트 유지)
                </button>
                <button type="button" role="menuitem" className="context-menu-item danger" onClick={deleteSectionFromMenu}>
                  <Trash2 size={14} />
                  섹션 및 노트 전체 삭제
                </button>
              </>
            ) : (
              <>
                {!menuTargetIsMemo && (
                  <button
                    type="button"
                    role="menuitem"
                    className="context-menu-item"
                    onClick={() => insertPageAfterFromMenu()}
                  >
                    <Plus size={14} />
                    다음에 노트 추가
                  </button>
                )}
                <button type="button" role="menuitem" className="context-menu-item" onClick={splitSectionFromMenu}>
                  <Plus size={14} />
                  여기부터 새 섹션
                </button>
                <button type="button" role="menuitem" className="context-menu-item" onClick={toggleCoverFromMenu}>
                  <Presentation size={14} />
                  {menuTargetIsCover ? "갑지 해제" : "갑지 변경"}
                </button>
                <button type="button" role="menuitem" className="context-menu-item danger" onClick={deletePageFromMenu}>
                  <Trash2 size={14} />
                  {menuTargetIsMemo ? "메모 삭제" : "노트 삭제"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {confirmDeletePage && (
        <ConfirmModal
          title={confirmDeletePage.isMemo ? "메모 삭제" : "노트 삭제"}
          message={`'${confirmDeletePage.label}' ${confirmDeletePage.isMemo ? "메모" : "노트"}를 삭제하시겠습니까?`}
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
  onExportProject,
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
  onExportProject: (project: Project) => void;
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
    if (!dragId || dragId === project.id) {
      setDrop(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
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
            onClick={onQuickCreateProject}
            title="새 프로젝트 만들기"
          >
            <Plus size={20} />새 프로젝트
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
                  left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 168 - 8)),
                  top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 56 - 8))
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  onClick={() => {
                    onUpdateProject(target.id, (proj) => ({
                      ...proj,
                      sections: moveMemoSectionsToEnd([
                        ...proj.sections,
                        { id: uid("section"), title: "새 섹션", collapsed: false, pages: [] }
                      ])
                    }));
                    setContextMenu(null);
                  }}
                >
                  <Plus size={14} />
                  섹션 추가
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  onClick={() => {
                    onRenameProject(target.id, window.prompt("프로젝트 이름", target.name) || target.name);
                    setContextMenu(null);
                  }}
                >
                  <Pencil size={14} />
                  이름 변경
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  onClick={() => {
                    onExportProject(target);
                    setContextMenu(null);
                  }}
                >
                  <Download size={14} />
                  내보내기
                </button>
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

    function getFieldAccuracy(targetText: string, query: string): number {
      const target = targetText.toLowerCase();
      const index = target.indexOf(query);
      if (index < 0) return -1;

      // Base coverage (0.0 to 1.0)
      let score = query.length / target.length;

      // Starts-with bonus
      if (index === 0) {
        score += 2.0;
      }

      // Exact match bonus
      if (target === query) {
        score += 5.0;
      }

      return score;
    }

    const matchedItems: Array<{
      project: Project;
      section: ScriptSection;
      page: ScriptPage;
      score: number;
      matchType: string;
    }> = [];

    for (const project of projects) {
      for (const section of project.sections) {
        for (const page of section.pages) {
          const projAcc = Math.max(
            getFieldAccuracy(project.name, normalizedQuery),
            project.siteName ? getFieldAccuracy(project.siteName, normalizedQuery) : -1
          );
          const tagAcc = Math.max(
            ...(page.tags ?? []).map((tag) => getFieldAccuracy(tag, normalizedQuery)),
            -1
          );
          const titleAcc = getFieldAccuracy(page.title, normalizedQuery);
          const sectAcc = getFieldAccuracy(section.title, normalizedQuery);
          const contentAcc = Math.max(
            getFieldAccuracy(richTextPlain(page.script), normalizedQuery),
            getFieldAccuracy(page.memo, normalizedQuery),
            ...(page.referenceLinks ?? []).map((link) => getFieldAccuracy(link, normalizedQuery)),
            -1
          );

          const candidates = [
            { type: "프로젝트명", score: projAcc >= 0 ? projAcc + 3.0 : -1 },
            { type: "태그", score: tagAcc >= 0 ? tagAcc + 2.0 : -1 },
            { type: "노트 제목", score: titleAcc >= 0 ? titleAcc + 1.0 : -1 },
            { type: "섹션명", score: sectAcc >= 0 ? sectAcc + 0.5 : -1 },
            { type: "본문/메모", score: contentAcc >= 0 ? contentAcc + 0.0 : -1 }
          ];

          const bestMatch = candidates.reduce(
            (best, cur) => (cur.score > best.score ? cur : best),
            { type: "", score: -1 }
          );

          if (bestMatch.score >= 0) {
            matchedItems.push({
              project,
              section,
              page,
              score: bestMatch.score,
              matchType: bestMatch.type
            });
          }
        }
      }
    }

    return matchedItems.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [normalizedQuery, projects]);

  function open(projectId: Id<"projects">, pageId: string) {
    onOpenResult(projectId, pageId);
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
          onBlur={() => {
            // Allow onMouseDown on results to complete before hiding
            setTimeout(() => setFocused(false), 180);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (results.length > 0) {
                const first = results[0];
                open(first.project.id, first.page.id);
                (event.target as HTMLInputElement).blur();
              }
            } else if (event.key === "Escape") {
              setFocused(false);
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder="모든 프로젝트, 노트, 태그 검색"
        />
        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
            }}
          >
            <X size={15} />
          </button>
        )}
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
                  {item.matchType && <span className="search-match-badge">{item.matchType}</span>}
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
  onOpenPage,
  onSelectProject,
  activeProjectId,
  expandedProjectIds,
  onToggleProjectExpanded,
  sort,
  mode
}: {
  projects: Project[];
  onRequestCreate: () => void;
  onEditProject: (id: Id<"projects">, input: { name: string; siteName: string; labelColor: LabelColor }) => void;
  onDeleteProject: (id: Id<"projects">) => void;
  onToggleFavorite: (id: Id<"projects">) => void;
  onOpenProject: (projectId: Id<"projects">) => void;
  onOpenPage: (projectId: Id<"projects">, pageId: string) => void;
  onSelectProject: (projectId: Id<"projects"> | "") => void;
  activeProjectId: Id<"projects"> | "";
  expandedProjectIds: Set<Id<"projects">>;
  onToggleProjectExpanded: (projectId: Id<"projects">) => void;
  sort: "recent" | "name";
  mode: "grid" | "list";
}) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [folderForm, setFolderForm] = useState({
    name: "",
    siteName: "",
    labelColor: "green" as LabelColor
  });

  const visibleProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "ko");
        if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [projects, sort]);

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
      <div className={`folder-list ${mode}`}>
        {visibleProjects.map((project) => {
          const pageCount = countNotes(project);
          const expanded = expandedProjectIds.has(project.id);
          return (
            <article
              key={project.id}
              className={`folder-card ${project.id === activeProjectId ? "selected" : ""} ${expanded ? "expanded" : ""}`}
            >
              <button className="folder-main" onClick={() => onOpenProject(project.id)}>
                <span className={`label-strip ${project.labelColor}`} />
                <span className="folder-title">{project.name}</span>
                <span className="folder-site">{project.siteName}</span>
                <span className="folder-meta">
                  <span>{pageCount}개 노트</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </span>
              </button>
              <div className="folder-tools">
                <button
                  type="button"
                  className="icon-btn folder-expand-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleProjectExpanded(project.id);
                  }}
                  aria-label={expanded ? "접기" : "펼치기"}
                  title={expanded ? "접기" : "펼치기"}
                  aria-expanded={expanded}
                >
                  <ChevronDown size={20} className={expanded ? "" : "rotated"} />
                </button>
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
              {expanded &&
                (() => {
                  const pageNumberMap = pageNumbers(project);
                  const notes = flattenPages(project).filter((item) => !isMemoPage(item.page));
                  return (
                    <div className="folder-notes">
                      {notes.length === 0 ? (
                        <p className="folder-notes-empty">노트가 없습니다.</p>
                      ) : (
                        notes.map(({ page }) => {
                          const pageNum = pageNumberMap.get(page.id);
                          return (
                            <button
                              key={page.id}
                              type="button"
                              className="folder-note-item"
                              onClick={() => onOpenPage(project.id, page.id)}
                              title={pageWord(page)}
                            >
                              {pageNum != null ? <span className="folder-note-num">P.{pageNum}</span> : null}
                              <span className="folder-note-title">{pageWord(page)}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })()}
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
  onUpdateProject,
  onNavigate,
  onAddPage,
  onExport
}: {
  project: Project;
  selectedPageId: string;
  onUpdateProject: (updater: (project: Project) => Project) => void;
  onNavigate: (view: View) => void;
  onAddPage: (sectionId?: string) => void;
  onExport: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState({ memo: false, links: false, tags: false });
  const [tagDraft, setTagDraft] = useState("");
  const [memoColumnWidths, setMemoColumnWidths] = useState<number[]>([]);
  const [memoViewCount, setMemoViewCount] = useState(1);
  const memoColumnsRef = useRef<HTMLDivElement | null>(null);
  const flatPages = flattenPages(project);
  const selected = selectedPageId ? flatPages.find((item) => item.page.id === selectedPageId) : undefined;
  const selectedPage = selected?.page;

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
  const combinedNotes = flattenPages(project).filter((item) => !isMemoPage(item.page));
  const combinedNumbers = pageNumbers(project);
  const combinedLabel = (page: ScriptPage) => `P.${combinedNumbers.get(page.id) ?? "?"}`;
  const [combinedCopied, setCombinedCopied] = useState(false);

  async function copyCombinedScript() {
    const text = combinedNotes
      .map((item) => {
        const title = item.page.title.trim() || "제목 없는 노트";
        const script = richTextPlain(item.page.script).trim() || "원고 없음";
        return `${combinedLabel(item.page)} ${title}\n\n${script}`;
      })
      .join("\n\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 API를 쓸 수 없는 환경(http 등)에서는 임시 textarea로 복사한다.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCombinedCopied(true);
    window.setTimeout(() => setCombinedCopied(false), 2000);
  }
  const selectedIsMemo = selectedPage ? isMemoPage(selectedPage) : false;
  const memoPageColumns = selectedIsMemo && selectedPage ? decodeMemoPageColumns(selectedPage.script) : [];
  const activeMemoColumnWidths =
    memoColumnWidths.length === memoPageColumns.length ? memoColumnWidths : equalMemoColumnWidths(memoPageColumns.length);

  useEffect(() => {
    if (!selectedIsMemo || !selectedPage) return;
    const storageKey = `pt-memo-column-widths:${selectedPage.id}:${memoPageColumns.length}`;
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(stored) && stored.length === memoPageColumns.length && stored.every((width) => typeof width === "number" && width > 0)) {
        setMemoColumnWidths(stored);
        return;
      }
    } catch {
      // Invalid saved sizing falls back to evenly sized columns.
    }
    setMemoColumnWidths(equalMemoColumnWidths(memoPageColumns.length));
  }, [selectedIsMemo, selectedPage?.id, memoPageColumns.length]);

  useEffect(() => {
    setMemoViewCount(1);
  }, [selectedPage?.id]);

  function updateMemoPageColumn(columnIndex: number, value: string) {
    const columns = [...memoPageColumns];
    columns[columnIndex] = value;
    updateSelectedPage({ script: encodeMemoPageColumns(columns) });
  }

  function setMemoPageSplitCount(count: number) {
    const columns = [...memoPageColumns];
    while (columns.length < count) columns.push("");
    while (columns.length > count) {
      const lastColumn = columns.pop() ?? "";
      const previousIndex = columns.length - 1;
      columns[previousIndex] = mergeRichText(columns[previousIndex], lastColumn);
    }
    if (count > 1) setMemoViewCount(1);
    updateSelectedPage({ script: encodeMemoPageColumns(columns) });
  }

  function startMemoColumnResize(index: number, event: React.PointerEvent<HTMLDivElement>) {
    const container = memoColumnsRef.current;
    if (!container) return;
    const startX = event.clientX;
    const startWidths = [...activeMemoColumnWidths];
    let finalWidths = startWidths;
    const minWidth = 14;
    const storageKey = `pt-memo-column-widths:${selectedPage?.id}:${memoPageColumns.length}`;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const availableWidth = container.getBoundingClientRect().width - (memoPageColumns.length - 1) * 12;
      if (availableWidth <= 0) return;
      const delta = ((moveEvent.clientX - startX) / availableWidth) * 100;
      const left = startWidths[index] + delta;
      const right = startWidths[index + 1] - delta;
      if (left < minWidth || right < minWidth) return;
      const next = [...startWidths];
      next[index] = left;
      next[index + 1] = right;
      finalWidths = next;
      setMemoColumnWidths(next);
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(finalWidths));
      } catch {
        // The resize still works if browser storage is unavailable.
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <section className="project-screen">
      <div className="project-workspace">
        <section className="editor-pane">
          {selectedPage ? (
            <article className="editor-surface">
              <div className="editor-head">
                <input
                  className="title-input"
                  value={selectedPage.title}
                  onChange={(event) => updateSelectedPage({ title: event.target.value })}
                  aria-label="노트 제목"
                />
              </div>
              {selectedIsMemo ? (
                <div className="memo-page-editor">
                  <div className="memo-split-toolbar">
                    <span>세로 분할</span>
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`btn subtle ${memoPageColumns.length === count ? "active" : ""}`}
                        onClick={() => setMemoPageSplitCount(count)}
                      >
                        {count === 1 ? "없음" : `${count}분할`}
                      </button>
                    ))}
                    <span className="memo-toolbar-divider" />
                    <span>뷰</span>
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={`view-${count}`}
                        type="button"
                        disabled={memoPageColumns.length !== 1}
                        className={`btn subtle ${memoViewCount === count ? "active" : ""}`}
                        onClick={() => setMemoViewCount(count)}
                        title={memoPageColumns.length === 1 ? `한 메모를 ${count}개 뷰로 연속 표시` : "뷰 분리는 분할 없음에서만 사용할 수 있습니다."}
                      >
                        {count === 1 ? "없음" : `${count}뷰`}
                      </button>
                    ))}
                  </div>
                  <div
                    ref={memoColumnsRef}
                    className={`memo-columns columns-${memoPageColumns.length}`}
                    style={{
                      gridTemplateColumns: memoPageColumns.flatMap((_, index) =>
                        index === memoPageColumns.length - 1
                          ? [`minmax(0, ${activeMemoColumnWidths[index]}fr)`]
                          : [`minmax(0, ${activeMemoColumnWidths[index]}fr)`, "12px"]
                      ).join(" ")
                    }}
                  >
                    {memoPageColumns.map((column, index) => (
                      <Fragment key={index}>
                        <label className="memo-column">
                          <span>메모 {index + 1}</span>
                          <RichTextEditor
                            className={`script-editor memo-page-column ${memoPageColumns.length === 1 ? `memo-view-columns-${memoViewCount}` : ""}`}
                            value={column}
                            onChange={(value) => updateMemoPageColumn(index, value)}
                            ariaLabel={`메모 ${index + 1}`}
                          />
                        </label>
                        {index < memoPageColumns.length - 1 && (
                          <div
                            className="memo-split-resizer"
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`메모 ${index + 1}과 메모 ${index + 2}의 너비 조절`}
                            onPointerDown={(event) => startMemoColumnResize(index, event)}
                          />
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <RichTextEditor
                  className="script-editor"
                  value={selectedPage.script}
                  onChange={(value) => updateSelectedPage({ script: value })}
                  ariaLabel="발표 원고"
                />
              )}
              <div className="page-details">
                {/* Memo pages only expose search tags; notes keep all three panels. */}
                {!selectedIsMemo && (
                <section className="detail-section">
                  <button className="detail-summary" onClick={() => toggleDetail("memo")}>
                    <ChevronDown size={16} className={detailOpen.memo ? "" : "rotated"} />
                    <strong>노트 메모</strong>
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
                )}

                {!selectedIsMemo && (
                <section className="detail-section">
                  <button className="detail-summary" onClick={() => toggleDetail("links")}>
                    <ChevronDown size={16} className={detailOpen.links ? "" : "rotated"} />
                    <strong>참고 링크</strong>
                    <span>{(selectedPage.referenceLinks ?? []).filter(Boolean).length}개 링크</span>
                  </button>
                  {detailOpen.links && (
                    <div className="detail-body links-editor">
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
                )}

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
          ) : (
            <div className="project-landing-surface project-overview-layout">
              <div className="landing-card">
                <span className="landing-emoji" role="img" aria-label="emoji">
                  {project.emoji}
                </span>
                <h2>{project.name}</h2>
                {project.siteName && <p className="landing-site-name">{project.siteName}</p>}

                <div className="landing-divider" />

                <div className="landing-stats">
                  <div className="landing-stat-item">
                    <span className="stat-value">{countNotes(project)}개</span>
                    <span className="stat-label">등록된 노트</span>
                  </div>
                  <div className="landing-stat-item">
                    <span className="stat-value">{formatDuration(totalSeconds)}</span>
                    <span className="stat-label">예상 발표 시간</span>
                  </div>
                </div>

                <div className="landing-actions">
                  <button className="btn primary landing-btn" onClick={() => onAddPage()}>
                    <Plus size={16} /> 새 노트 추가하기
                  </button>
                  <button className="btn subtle landing-btn" onClick={() => onNavigate("memos")}>
                    <Pin size={16} /> 프로젝트 메모
                  </button>
                  <button className="btn subtle landing-btn" onClick={onExport}>
                    <Download size={16} /> 내보내기
                  </button>
                </div>
              </div>
              <section className="combined-script-panel" aria-label="통합 대본">
                <div className="combined-script-head">
                  <div>
                    <p className="kicker">통합 대본</p>
                    <h2>{project.name}</h2>
                  </div>
                  <div className="combined-script-meta">
                    <span>{combinedNotes.length}개 노트</span>
                    <button
                      className="btn subtle"
                      type="button"
                      title="통합 대본을 PDF로 내보내기 (인쇄 대화상자)"
                      disabled={!combinedNotes.length}
                      onClick={() => printProject(project, new Set(combinedNotes.map((item) => item.page.id)))}
                    >
                      <FileDown size={15} /> PDF
                    </button>
                    <button
                      className="btn subtle"
                      type="button"
                      title="통합 대본 전체 텍스트 복사"
                      disabled={!combinedNotes.length}
                      onClick={copyCombinedScript}
                    >
                      <Copy size={15} /> {combinedCopied ? "복사됨" : "복사"}
                    </button>
                  </div>
                </div>
                <div className="combined-script-body">
                  {combinedNotes.map((item) => (
                    <article key={item.page.id} className="combined-script-note">
                      <p className="combined-script-number">{combinedLabel(item.page)}</p>
                      <h3>{item.page.title || "제목 없는 노트"}</h3>
                      <p>{richTextPlain(item.page.script).trim() || "원고 없음"}</p>
                    </article>
                  ))}
                  {!combinedNotes.length && <p className="hint">등록된 노트가 없습니다.</p>}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

// Open the project's print HTML in a new window and trigger the browser's
// print dialog (used as the "PDF" export via print-to-PDF).
function printProject(project: Project, selectedPageIds: Set<string>) {
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return;
  win.document.write(makePrintHtml(project, selectedPageIds));
  win.document.close();
  win.focus();
  // Let the new document lay out before invoking print.
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      /* user may have closed the window */
    }
  }, 250);
}

function ExportModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [scope, setScope] = useState<ExportScope>("all");
  const [format, setFormat] = useState<"xlsx" | "md" | "pdf">("xlsx");

  const ids = scopePageIds(project, scope);
  const count = ids.size;

  function run() {
    if (!count) return;
    if (format === "xlsx") exportXlsx(project, ids);
    else if (format === "md") downloadText(`${project.name}.md`, makeMarkdown(project, ids), "text/markdown;charset=utf-8");
    else if (format === "pdf") printProject(project, ids);
    onClose();
  }

  const scopes: Array<{ key: ExportScope; label: string }> = [
    { key: "all", label: "전부" },
    { key: "notes", label: "노트만" },
    { key: "memos", label: "메모만" }
  ];
  const formats: Array<{ key: "xlsx" | "md" | "pdf"; label: string }> = [
    { key: "xlsx", label: "엑셀 (.xlsx)" },
    { key: "md", label: "마크다운 (.md)" },
    { key: "pdf", label: "PDF" }
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal export-modal" style={{ maxWidth: 420, padding: "24px" }} onMouseDown={(event) => event.stopPropagation()}>
        <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>내보내기</h2>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>{project.name}</p>

        <div className="export-field">
          <span className="export-label">범위</span>
          <div className="segmented export-segmented" aria-label="내보내기 범위">
            {scopes.map((item) => (
              <button
                key={item.key}
                className={scope === item.key ? "active" : ""}
                onClick={() => setScope(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="export-field">
          <span className="export-label">형식</span>
          <div className="segmented export-segmented" aria-label="내보내기 형식">
            {formats.map((item) => (
              <button
                key={item.key}
                className={format === item.key ? "active" : ""}
                onClick={() => setFormat(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <p className="hint" style={{ marginBottom: "20px" }}>{count}개 페이지 포함</p>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={run} disabled={!count}>
            <Download size={16} />
            내보내기
          </button>
        </div>
      </div>
    </div>
  );
}

function MemosView({
  project,
  onSaveMemos,
  onNavigate,
  onDirtyChange,
  saveRef
}: {
  project: Project;
  onSaveMemos: (projectMemos: Record<MemoKind, string>) => void;
  onNavigate: (view: View) => void;
  onDirtyChange: (dirty: boolean) => void;
  saveRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [tab, setTab] = useState<MemoKind>("qa");
  const pagesWithMemos = flattenPages(project).filter((item) => item.page.memo.trim());

  const saved = project.projectMemos;
  // One draft per tab so switching tabs never loses unsaved text.
  const [drafts, setDrafts] = useState<Record<MemoKind, string>>(() => ({ ...saved }));
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Sync incoming Convex updates into drafts, but only for tabs the user hasn't
  // diverged from the previously-saved value — in-progress edits are preserved.
  const prevSavedRef = useRef(saved);
  useEffect(() => {
    const prev = prevSavedRef.current;
    setDrafts((current) => {
      const next = { ...current };
      (Object.keys(saved) as MemoKind[]).forEach((key) => {
        if (current[key] === prev[key]) next[key] = saved[key];
      });
      return next;
    });
    prevSavedRef.current = saved;
  }, [saved.qa, saved.caution, saved.feedback]);

  const dirty = (Object.keys(saved) as MemoKind[]).some((key) => drafts[key] !== saved[key]);

  // Report dirty state to parent
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function handleSave() {
    // Persist every tab in one write so no draft is left behind.
    onSaveMemos({ ...saved, ...drafts });
    setShowSavedModal(true);
  }

  // Expose save function to parent via ref
  useEffect(() => {
    saveRef.current = handleSave;
    return () => { saveRef.current = null; };
  });

  return (
    <section className="project-screen">
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
            <textarea
              value={drafts[tab]}
              onChange={(event) => setDrafts((current) => ({ ...current, [tab]: event.target.value }))}
            />
            <div className="memo-editor-footer">
              <div className="chips">
                <span>심사위원 질문</span>
                <span>40초 답변</span>
                <span>숫자 근거 확인 필요</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn" onClick={() => onNavigate("project")}>
                  노트로 돌아가기
                </button>
                <button className="btn primary" onClick={handleSave}>
                  저장
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel page-note-panel">
          <p className="kicker">노트별 메모</p>
          {pagesWithMemos.map((item) => (
            <article className="page-note-card" key={item.page.id}>
              <strong>{item.page.title}</strong>
              <p>{item.page.memo}</p>
            </article>
          ))}
          {!pagesWithMemos.length && <p className="hint">노트 메모가 아직 없습니다.</p>}
        </aside>
      </div>

      {showSavedModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" style={{ maxWidth: 320, textAlign: "center", padding: "24px" }}>
            <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>저장 완료</h2>
            <p style={{ color: "var(--muted)", marginBottom: "20px" }}>메모가 정상적으로 저장되었습니다.</p>
            <button className="btn primary" onClick={() => setShowSavedModal(false)} style={{ width: "100%" }}>
              확인
            </button>
          </div>
        </div>
      )}
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
  type DesignPart =
    | "nav"
    | "category"
    | "noteTitle"
    | "pageNum"
    | "noteContent"
    | "combinedTitle"
    | "combinedContent"
    | "memo"
    | "link"
    | "tag";
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
  }> = [
    {
      id: "nav",
      label: "네비게이션 바",
      description: "좌측 사이드바의 프로젝트 이름 행과 버튼입니다.",
      fontKey: "navFontFamily",
      sizeKey: "navTextSize",
      colorKey: "navTextColor"
    },
    {
      id: "category",
      label: "카테고리",
      description: "좌측 트리의 섹션(폴더) 제목입니다.",
      fontKey: "categoryFontFamily",
      sizeKey: "categoryTextSize",
      colorKey: "categoryTextColor"
    },
    {
      id: "noteTitle",
      label: "노트제목",
      description: "좌측 트리의 노트 제목 행입니다.",
      fontKey: "noteTitleFontFamily",
      sizeKey: "noteTitleTextSize",
      colorKey: "noteTitleTextColor"
    },
    {
      id: "pageNum",
      label: "페이지 번호",
      description: "좌측 트리 노트 행의 P.1, P.2 번호입니다.",
      fontKey: "pageNumFontFamily",
      sizeKey: "pageNumTextSize",
      colorKey: "pageNumTextColor"
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
      id: "combinedTitle",
      label: "통합대본 제목",
      description: "프로젝트 화면 우측 통합 대본의 노트 제목입니다.",
      fontKey: "combinedTitleFontFamily",
      sizeKey: "combinedTitleTextSize",
      colorKey: "combinedTitleTextColor"
    },
    {
      id: "combinedContent",
      label: "통합대본 내용",
      description: "통합 대본의 본문 내용입니다.",
      fontKey: "combinedContentFontFamily",
      sizeKey: "combinedContentTextSize",
      colorKey: "combinedContentTextColor"
    },
    {
      id: "memo",
      label: "메모",
      description: "노트 하단 메모 행의 글자입니다.",
      fontKey: "memoFontFamily",
      sizeKey: "memoTextSize",
      colorKey: "memoTextColor"
    },
    {
      id: "link",
      label: "참고링크",
      description: "노트별 참고 링크 입력 행입니다.",
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
                min={activePart.id === "noteContent" ? "18" : activePart.id === "pageNum" ? "8" : "12"}
                max={activePart.id === "noteContent" ? "36" : activePart.id === "pageNum" ? "20" : "30"}
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

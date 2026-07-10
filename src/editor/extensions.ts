import { Extension, type CommandProps } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";

export const INDENT_STEP_PX = 32;
export const MAX_INDENT_LEVEL = 8;

export function clampIndent(level: number): number {
  return Math.max(0, Math.min(MAX_INDENT_LEVEL, level));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pptIndent: {
      /** 들여쓰기 한 단계 늘리기 (목록에서는 수준 내리기). */
      indent: () => ReturnType;
      /** 들여쓰기 한 단계 줄이기 (목록에서는 수준 올리기). */
      outdent: () => ReturnType;
    };
    pptLineHeight: {
      /** 선택한 단락의 줄 간격을 지정. null이면 기본값으로 되돌린다. */
      setPptLineHeight: (value: string | null) => ReturnType;
    };
  }
}

const INDENT_TYPES = ["paragraph", "heading"];

/** PPT의 들여쓰기 늘리기/줄이기. 목록에서는 목록 수준을, 일반 단락에서는 여백을 조절한다. */
export const Indent = Extension.create({
  name: "pptIndent",

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const margin = Number.parseInt(element.style.marginLeft || "0", 10);
              return Number.isFinite(margin) && margin > 0 ? clampIndent(Math.round(margin / INDENT_STEP_PX)) : 0;
            },
            renderHTML: (attributes) => {
              const level = clampIndent(Number(attributes.indent) || 0);
              if (level === 0) return {};
              return { style: `margin-left: ${level * INDENT_STEP_PX}px` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    const changeIndent = (delta: 1 | -1) =>
      ({ editor, state, tr, dispatch, commands }: CommandProps) => {
        if (editor.isActive("listItem")) {
          return delta > 0 ? commands.sinkListItem("listItem") : commands.liftListItem("listItem");
        }
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          // 목록 내부 단락에 margin을 얹으면 목록 자체 들여쓰기와 중복된다.
          // 목록은 위의 sink/lift 분기가 담당하므로 하위 탐색을 중단한다.
          if (node.type.name === "bulletList" || node.type.name === "orderedList") return false;
          if (!INDENT_TYPES.includes(node.type.name)) return;
          const current = clampIndent(Number(node.attrs.indent) || 0);
          const next = clampIndent(current + delta);
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      indent: () => changeIndent(1),
      outdent: () => changeIndent(-1)
    };
  },

  addKeyboardShortcuts() {
    // 변경이 없으면 false를 돌려 브라우저 기본 Tab 이동을 허용한다(키보드 트랩 방지).
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent()
    };
  }
});

/** PPT의 줄 간격. 문자 단위가 아니라 단락 단위로 적용된다. */
export const ParagraphLineHeight = Extension.create({
  name: "pptLineHeight",

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setPptLineHeight:
        (value) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!INDENT_TYPES.includes(node.type.name)) return;
            if (node.attrs.lineHeight === value) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value });
            changed = true;
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        }
    };
  }
});

export function buildEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false }
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TextAlign.configure({
      types: INDENT_TYPES,
      alignments: ["left", "center", "right", "justify"]
    }),
    Highlight.configure({ multicolor: true }),
    Indent,
    ParagraphLineHeight
  ];
}

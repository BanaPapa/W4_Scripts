import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline
} from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { FontControls } from "./FontControls";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_TEXT_COLOR,
  LINE_HEIGHTS,
  loadRecentColors,
  parseFontSizePx,
  pushRecentColor,
  saveRecentColors,
  stepFontSize
} from "./constants";

export type RepeatAction = () => void;

/** 선택 영역의 실제 글꼴 크기(px). 명시적 크기 마크가 없으면
 *  CSS로 렌더링되는 기본 크기(--note-content-text-size 등)를 읽는다. */
export function resolveFontSize(editor: Editor): number {
  const explicit = editor.getAttributes("textStyle").fontSize as string | undefined;
  if (explicit) return parseFontSizePx(explicit);
  const computed = Number.parseFloat(window.getComputedStyle(editor.view.dom).fontSize);
  return Number.isFinite(computed) ? Math.round(computed) : DEFAULT_FONT_SIZE;
}

interface ToolbarProps {
  editor: Editor;
  /** F4(마지막 작업 반복)용. 툴바에서 실행한 마지막 서식 작업이 저장된다. */
  repeatRef: React.MutableRefObject<RepeatAction | null>;
}

/** PPT 홈 리본의 글꼴+단락 그룹과 동일한 구성의 툴바. */
export function Toolbar({ editor, repeatRef }: ToolbarProps) {
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [recentTextColors, setRecentTextColors] = useState<string[]>(() => loadRecentColors("text"));

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      alignLeft: current.isActive({ textAlign: "left" }),
      alignCenter: current.isActive({ textAlign: "center" }),
      alignRight: current.isActive({ textAlign: "right" }),
      alignJustify: current.isActive({ textAlign: "justify" }),
      fontFamily: current.getAttributes("textStyle").fontFamily as string | undefined,
      fontSize: resolveFontSize(current),
      lineHeight: (current.getAttributes("paragraph").lineHeight as string | null) ?? null
    })
  });

  /** 서식 작업을 실행하고 F4 반복 대상으로 등록한다. */
  function run(action: RepeatAction) {
    action();
    repeatRef.current = action;
  }

  function applyTextColor(color: string | null) {
    if (color === null) {
      run(() => editor.chain().focus().unsetColor().run());
      return;
    }
    setTextColor(color);
    setRecentTextColors((current) => {
      const next = pushRecentColor(current, color);
      saveRecentColors("text", next);
      return next;
    });
    run(() => editor.chain().focus().setColor(color).run());
  }

  function applyHighlight(color: string | null) {
    if (color === null) {
      run(() => editor.chain().focus().unsetHighlight().run());
      return;
    }
    setHighlightColor(color);
    run(() => editor.chain().focus().setHighlight({ color }).run());
  }

  function applyFontSize(size: number) {
    run(() => editor.chain().focus().setFontSize(`${size}px`).run());
  }

  /** A↑/A↓: F4로 반복하면 매번 현재 크기에서 한 단계 더 이동한다 (PPT 동일). */
  function stepSize(direction: "up" | "down") {
    run(() => {
      editor.chain().focus().setFontSize(`${stepFontSize(resolveFontSize(editor), direction)}px`).run();
    });
  }

  return (
    <div className="rich-text-toolbar" role="toolbar" aria-label="텍스트 서식">
      <div className="rt-group">
        <FontControls
          currentFamily={state.fontFamily}
          currentSize={state.fontSize}
          onFamily={(value) => run(() => editor.chain().focus().setFontFamily(value).run())}
          onSize={applyFontSize}
          onStepSize={stepSize}
        />
      </div>
      <span className="rt-divider" />
      <div className="rt-group">
        <ToolbarButton
          icon={<Bold size={16} />}
          label="굵게 (Ctrl+B)"
          active={state.bold}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())}
        />
        <ToolbarButton
          icon={<Italic size={16} />}
          label="기울임꼴 (Ctrl+I)"
          active={state.italic}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
        />
        <ToolbarButton
          icon={<Underline size={16} />}
          label="밑줄 (Ctrl+U)"
          active={state.underline}
          onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
        />
        <ToolbarButton
          icon={<Strikethrough size={16} />}
          label="취소선"
          active={state.strike}
          onClick={() => run(() => editor.chain().focus().toggleStrike().run())}
        />
        <ColorPicker
          kind="highlight"
          label="텍스트 형광펜 색"
          icon={<Highlighter size={16} />}
          currentColor={highlightColor}
          recentColors={[]}
          onPick={applyHighlight}
        />
        <ColorPicker
          kind="text"
          label="글꼴 색"
          icon={<Baseline size={16} />}
          currentColor={textColor}
          recentColors={recentTextColors}
          onPick={applyTextColor}
        />
        <ToolbarButton
          icon={<RemoveFormatting size={16} />}
          label="모든 서식 지우기"
          onClick={() => run(() => editor.chain().focus().unsetAllMarks().run())}
        />
      </div>
      <span className="rt-divider" />
      <div className="rt-group">
        <ToolbarButton
          icon={<List size={16} />}
          label="글머리 기호"
          active={state.bulletList}
          onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
        />
        <ToolbarButton
          icon={<ListOrdered size={16} />}
          label="번호 매기기"
          active={state.orderedList}
          onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}
        />
        <ToolbarButton
          icon={<IndentDecrease size={16} />}
          label="들여쓰기 줄이기 (Shift+Tab)"
          onClick={() => run(() => editor.chain().focus().outdent().run())}
        />
        <ToolbarButton
          icon={<IndentIncrease size={16} />}
          label="들여쓰기 늘리기 (Tab)"
          onClick={() => run(() => editor.chain().focus().indent().run())}
        />
        <LineHeightDropdown
          current={state.lineHeight}
          onPick={(value) => run(() => editor.chain().focus().setPptLineHeight(value).run())}
        />
      </div>
      <span className="rt-divider" />
      <div className="rt-group">
        <ToolbarButton
          icon={<AlignLeft size={16} />}
          label="왼쪽 맞춤"
          active={state.alignLeft}
          onClick={() => run(() => editor.chain().focus().setTextAlign("left").run())}
        />
        <ToolbarButton
          icon={<AlignCenter size={16} />}
          label="가운데 맞춤"
          active={state.alignCenter}
          onClick={() => run(() => editor.chain().focus().setTextAlign("center").run())}
        />
        <ToolbarButton
          icon={<AlignRight size={16} />}
          label="오른쪽 맞춤"
          active={state.alignRight}
          onClick={() => run(() => editor.chain().focus().setTextAlign("right").run())}
        />
        <ToolbarButton
          icon={<AlignJustify size={16} />}
          label="양쪽 맞춤"
          active={state.alignJustify}
          onClick={() => run(() => editor.chain().focus().setTextAlign("justify").run())}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rt-btn ${active ? "is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function LineHeightDropdown({ current, onPick }: { current: string | null; onPick: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="rt-dropdown" ref={rootRef}>
      <button
        type="button"
        className="rt-btn rt-dropdown-toggle"
        title="줄 간격"
        aria-label="줄 간격"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="rt-line-height-icon">↕¶</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="rt-popover rt-dropdown-list" onMouseDown={(event) => event.preventDefault()}>
          {LINE_HEIGHTS.map((value) => (
            <button
              key={value}
              type="button"
              className={`rt-dropdown-item ${value === current ? "is-active" : ""}`}
              onClick={() => {
                setOpen(false);
                onPick(value);
              }}
            >
              {value === "1" ? "1.0" : value}
            </button>
          ))}
          <button type="button" className="rt-dropdown-item" onClick={() => { setOpen(false); onPick(null); }}>
            기본값
          </button>
        </div>
      )}
    </div>
  );
}

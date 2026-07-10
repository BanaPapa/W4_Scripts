import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { encodeRichText, richTextHtml } from "../richText";
import { buildEditorExtensions } from "./extensions";
import { resolveFontSize, Toolbar, type RepeatAction } from "./Toolbar";
import { stepFontSize } from "./constants";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className: string;
  ariaLabel: string;
}

/** PPT 스타일 서식 툴바를 갖춘 리치 텍스트 에디터 (TipTap 기반). */
export function RichTextEditor({ value, onChange, className, ariaLabel }: RichTextEditorProps) {
  const repeatRef = useRef<RepeatAction | null>(null);
  const lastEmittedHtmlRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // useEditor는 렌더마다 옵션을 비교해 setOptions를 호출하므로,
  // 옵션 객체를 한 번만 만들어 매 키 입력마다 확장 트리가 재생성되는 것을 막는다.
  // className/value의 이후 변경은 아래 useEffect들이 반영한다.
  const initialOptionsRef = useRef<Parameters<typeof useEditor>[0] | null>(null);
  if (!initialOptionsRef.current) {
    initialOptionsRef.current = {
      extensions: buildEditorExtensions(),
      content: richTextHtml(value),
      editorProps: {
        attributes: { class: className, "aria-label": ariaLabel }
      },
      onUpdate: ({ editor: current }) => {
        const html = current.getHTML();
        lastEmittedHtmlRef.current = html;
        onChangeRef.current(encodeRichText(html));
      }
    };
  }
  const editor = useEditor(initialOptionsRef.current);

  // 페이지 전환 등 외부에서 value가 바뀌면 에디터 내용을 동기화한다.
  // 자신이 방금 내보낸 변경은 되돌려 쓰지 않는다(커서 유지).
  useEffect(() => {
    if (!editor) return;
    const html = richTextHtml(value);
    if (html === lastEmittedHtmlRef.current) return;
    if (html === editor.getHTML()) return;
    editor.commands.setContent(html, { emitUpdate: false });
    lastEmittedHtmlRef.current = null;
  }, [value, editor]);

  // 메모 뷰 분할처럼 className이 동적으로 바뀌는 경우를 반영한다.
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: { attributes: { class: className, "aria-label": ariaLabel } }
    });
  }, [editor, className, ariaLabel]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!editor) return;
    if (event.key === "F4" && repeatRef.current) {
      event.preventDefault();
      event.stopPropagation();
      repeatRef.current();
      return;
    }
    const isModifier = event.ctrlKey || event.metaKey;
    const increase = isModifier && event.shiftKey && (event.key === ">" || event.key === ".");
    const decrease = isModifier && event.shiftKey && (event.key === "<" || event.key === ",");
    if (increase || decrease) {
      event.preventDefault();
      const direction = increase ? "up" : "down";
      const action = () => {
        editor.chain().focus().setFontSize(`${stepFontSize(resolveFontSize(editor), direction)}px`).run();
      };
      action();
      repeatRef.current = action;
    }
  }

  if (!editor) return null;

  return (
    <div className="rich-text-editor" onKeyDown={handleKeyDown}>
      <Toolbar editor={editor} repeatRef={repeatRef} />
      <EditorContent editor={editor} className="rt-content" />
    </div>
  );
}

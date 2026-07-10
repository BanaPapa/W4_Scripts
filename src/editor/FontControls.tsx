import { useEffect, useRef, useState } from "react";
import { AArrowDown, AArrowUp, ChevronDown } from "lucide-react";
import {
  clampFontSize,
  FONT_FAMILIES,
  FONT_SIZE_PRESETS,
  fontLabelFromValue
} from "./constants";

interface FontControlsProps {
  currentFamily: string | undefined;
  currentSize: number;
  onFamily: (value: string) => void;
  onSize: (size: number) => void;
  onStepSize: (direction: "up" | "down") => void;
}

/** PPT의 글꼴 드롭다운 + 크기 콤보(직접 입력 및 프리셋) + 크게/작게 버튼. */
export function FontControls({ currentFamily, currentSize, onFamily, onSize, onStepSize }: FontControlsProps) {
  return (
    <>
      <FontFamilyDropdown currentFamily={currentFamily} onFamily={onFamily} />
      <FontSizeCombo currentSize={currentSize} onSize={onSize} />
      <button
        type="button"
        className="rt-btn"
        title="글꼴 크기 크게 (Ctrl+Shift+>)"
        aria-label="글꼴 크기 크게"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onStepSize("up")}
      >
        <AArrowUp size={16} />
      </button>
      <button
        type="button"
        className="rt-btn"
        title="글꼴 크기 작게 (Ctrl+Shift+<)"
        aria-label="글꼴 크기 작게"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onStepSize("down")}
      >
        <AArrowDown size={16} />
      </button>
    </>
  );
}

function FontFamilyDropdown({ currentFamily, onFamily }: { currentFamily: string | undefined; onFamily: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const label = fontLabelFromValue(currentFamily);

  useClickOutside(rootRef, open, () => setOpen(false));

  return (
    <div className="rt-dropdown rt-font-family" ref={rootRef}>
      <button
        type="button"
        className="rt-btn rt-dropdown-toggle"
        title="글꼴"
        aria-label="글꼴"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="rt-font-label">{label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="rt-popover rt-dropdown-list" onMouseDown={(event) => event.preventDefault()}>
          {FONT_FAMILIES.map((font) => (
            <button
              key={font.label}
              type="button"
              className={`rt-dropdown-item ${font.label === label ? "is-active" : ""}`}
              style={{ fontFamily: font.value }}
              onClick={() => {
                setOpen(false);
                onFamily(font.value);
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FontSizeCombo({ currentSize, onSize }: { currentSize: number; onSize: (size: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(rootRef, open, () => setOpen(false));

  function commitDraft() {
    if (draft === null) return;
    const parsed = Number.parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(parsed)) onSize(clampFontSize(parsed));
  }

  return (
    <div className="rt-dropdown rt-font-size" ref={rootRef}>
      <input
        type="text"
        inputMode="numeric"
        className="rt-size-input"
        aria-label="글꼴 크기"
        title="글꼴 크기"
        value={draft ?? String(currentSize)}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
          if (event.key === "Escape") setDraft(null);
        }}
      />
      <button
        type="button"
        className="rt-btn rt-color-arrow"
        title="글꼴 크기 목록"
        aria-label="글꼴 크기 목록"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="rt-popover rt-dropdown-list rt-size-list" onMouseDown={(event) => event.preventDefault()}>
          {FONT_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              className={`rt-dropdown-item ${size === currentSize ? "is-active" : ""}`}
              onClick={() => {
                setOpen(false);
                onSize(size);
              }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, ref, onOutside]);
}

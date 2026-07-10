import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  STANDARD_COLORS,
  THEME_BASE_COLORS,
  themeColorVariants
} from "./constants";

interface ColorPickerProps {
  kind: "text" | "highlight";
  /** 분할버튼 본체를 눌렀을 때 바로 적용되는 현재 색. */
  currentColor: string;
  recentColors: string[];
  /** color를 적용한다. null이면 "자동"(글자색) / "형광펜 없음"(형광펜). */
  onPick: (color: string | null) => void;
  icon: React.ReactNode;
  label: string;
}

/** PPT의 글자색/형광펜 분할버튼. 본체 클릭은 즉시 적용, 화살표는 팔레트를 연다. */
export function ColorPicker({ kind, currentColor, recentColors, onPick, icon, label }: ColorPickerProps) {
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

  function pick(color: string | null) {
    setOpen(false);
    onPick(color);
  }

  return (
    <div className="rt-color-split" ref={rootRef}>
      <button
        type="button"
        className="rt-btn rt-color-main"
        title={`${label} (${currentColor})`}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPick(currentColor)}
      >
        {icon}
        <span className="rt-color-bar" style={{ backgroundColor: currentColor }} />
      </button>
      <button
        type="button"
        className="rt-btn rt-color-arrow"
        title={`${label} 팔레트`}
        aria-label={`${label} 팔레트 열기`}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="rt-popover rt-color-popover" onMouseDown={(event) => event.preventDefault()}>
          {kind === "highlight" ? (
            <>
              <div className="rt-color-grid rt-color-grid-5">
                {HIGHLIGHT_COLORS.map((color) => (
                  <ColorSwatch key={color} color={color} active={color === currentColor} onPick={pick} />
                ))}
              </div>
              <button type="button" className="rt-color-none" onClick={() => pick(null)}>
                형광펜 없음
              </button>
            </>
          ) : (
            <>
              <button type="button" className="rt-color-none" onClick={() => pick(null)}>
                <span className="rt-auto-swatch" /> 자동
              </button>
              <strong>테마 색</strong>
              <div className="rt-color-grid rt-color-grid-10">
                {THEME_BASE_COLORS.map((base) => (
                  <ColorSwatch key={base} color={base} active={base === currentColor} onPick={pick} />
                ))}
                {[0, 1, 2, 3, 4].flatMap((row) =>
                  THEME_BASE_COLORS.map((base) => {
                    const color = themeColorVariants(base)[row];
                    return <ColorSwatch key={`${base}-${row}`} color={color} active={color === currentColor} onPick={pick} />;
                  })
                )}
              </div>
              <strong>표준 색</strong>
              <div className="rt-color-grid rt-color-grid-10">
                {STANDARD_COLORS.map((color) => (
                  <ColorSwatch key={color} color={color} active={color === currentColor} onPick={pick} />
                ))}
              </div>
              {recentColors.length > 0 && (
                <>
                  <strong>최근 사용한 색</strong>
                  <div className="rt-color-grid rt-color-grid-10">
                    {recentColors.map((color) => (
                      <ColorSwatch key={color} color={color} active={color === currentColor} onPick={pick} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <label className="rt-custom-color">
            다른 색
            <input
              type="color"
              value={toHexInput(currentColor)}
              onChange={(event) => pick(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ color, active, onPick }: { color: string; active: boolean; onPick: (color: string) => void }) {
  return (
    <button
      type="button"
      className={`rt-swatch ${active ? "is-active" : ""}`}
      title={color}
      style={{ backgroundColor: color }}
      onClick={() => onPick(color)}
    />
  );
}

/** input[type=color]는 #rrggbb만 허용한다. */
function toHexInput(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
}

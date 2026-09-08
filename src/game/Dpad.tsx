import { useCallback, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DOWN, LEFT, RIGHT, UP, type Dir } from "./types";

interface DpadProps {
  onDir: (dir: Dir | null) => void;
}

export function Dpad({ onDir }: DpadProps) {
  const hold = useCallback(
    (dir: Dir) => (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onDir(dir);
    },
    [onDir],
  );
  const release = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onDir(null);
    },
    [onDir],
  );

  return (
    <div className="dpad" aria-label="Direction pad">
      <PadBtn className="dpad-up" dir={UP} onHold={hold} onRelease={release}>
        <ChevronUp className="icon-lg" strokeWidth={2.4} />
      </PadBtn>
      <PadBtn className="dpad-left" dir={LEFT} onHold={hold} onRelease={release}>
        <ChevronLeft className="icon-lg" strokeWidth={2.4} />
      </PadBtn>
      <PadBtn className="dpad-right" dir={RIGHT} onHold={hold} onRelease={release}>
        <ChevronRight className="icon-lg" strokeWidth={2.4} />
      </PadBtn>
      <PadBtn className="dpad-down" dir={DOWN} onHold={hold} onRelease={release}>
        <ChevronDown className="icon-lg" strokeWidth={2.4} />
      </PadBtn>
      <div className="dpad-core" aria-hidden />
    </div>
  );
}

function PadBtn({
  className,
  dir,
  onHold,
  onRelease,
  children,
}: {
  className: string;
  dir: Dir;
  onHold: (dir: Dir) => (e: PointerEvent<HTMLButtonElement>) => void;
  onRelease: (e: PointerEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`dpad-btn ${className}`}
      aria-label={label(dir)}
      onPointerDown={onHold(dir)}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      {children}
    </button>
  );
}

function label(dir: Dir): string {
  return ["Up", "Left", "Down", "Right"][dir] ?? "Move";
}

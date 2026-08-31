import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export interface FloatingPanelProps {
  panelId: string;
  title: string;
  eyebrow: string;
  position: FloatingPanelPosition;
  zIndex: number;
  focused: boolean;
  movable?: boolean;
  className?: string;
  children: ReactNode;
  onFocus: () => void;
  onMove: (position: FloatingPanelPosition) => void;
  onMinimize: () => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: FloatingPanelPosition;
}

const KEYBOARD_STEP = 16;

export function FloatingPanel({
  panelId,
  title,
  eyebrow,
  position,
  zIndex,
  focused,
  movable = true,
  className = '',
  children,
  onFocus,
  onMove,
  onMinimize,
}: FloatingPanelProps) {
  const drag = useRef<DragState | undefined>(undefined);
  const titleId = `strategy-panel-${panelId}-title`;

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!movable) return;
    if (event.button !== 0) return;
    onFocus();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const continueDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    onMove({
      x: drag.current.origin.x + event.clientX - drag.current.startX,
      y: drag.current.origin.y + event.clientY - drag.current.startY,
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!movable) return;
    const delta = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP;
    const next = { ...position };
    if (event.key === 'ArrowLeft') next.x -= delta;
    else if (event.key === 'ArrowRight') next.x += delta;
    else if (event.key === 'ArrowUp') next.y -= delta;
    else if (event.key === 'ArrowDown') next.y += delta;
    else return;
    event.preventDefault();
    onFocus();
    onMove(next);
  };

  return (
    <section
      className={`strategy-floating-panel ${focused ? 'is-focused' : ''} ${movable ? '' : 'is-static'} ${className}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, zIndex }}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-panel-id={panelId}
      onPointerDown={onFocus}
    >
      <div
        className="floating-panel-handle"
        tabIndex={movable ? 0 : -1}
        aria-label={movable ? `Move ${title} panel. Use arrow keys or drag.` : `${title} panel`}
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={moveWithKeyboard}
      >
        <span aria-hidden="true" className="panel-grip">⠿</span>
        <span className="panel-heading-copy">
          <small>{eyebrow}</small>
          <strong id={titleId}>{title}</strong>
        </span>
        <button
          className="panel-minimize"
          type="button"
          aria-label={`Minimize ${title} panel`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onMinimize}
        >
          <span aria-hidden="true">—</span>
        </button>
      </div>
      <div className="floating-panel-content">{children}</div>
    </section>
  );
}

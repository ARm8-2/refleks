import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const DRAG_THRESHOLD = 4;

type DragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  isDragging: boolean;
};

export function useHorizontalDragScroll() {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: event.currentTarget.scrollLeft,
        isDragging: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      if (!drag.isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) return;

      if (!drag.isDragging) {
        drag.isDragging = true;
        setIsDragging(true);
      }

      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX;
    },
    [],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.isDragging) suppressClickRef.current = true;
    dragRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    },
    [],
  );

  return {
    isDragging,
    dragScrollProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture: handleClickCapture,
    },
  };
}

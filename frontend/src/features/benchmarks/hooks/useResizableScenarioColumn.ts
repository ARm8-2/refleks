import { useRef, useState } from "react";
import {
  SCENARIO_DEFAULT_WIDTH,
  SCENARIO_MAX_WIDTH,
  SCENARIO_MIN_WIDTH,
} from "../lib/detailConstants";

type Options = {
  initialWidth?: number;
  min?: number;
  max?: number;
};

export function useResizableScenarioColumn(options: Options = {}) {
  const {
    initialWidth = SCENARIO_DEFAULT_WIDTH,
    min = SCENARIO_MIN_WIDTH,
    max = SCENARIO_MAX_WIDTH,
  } = options;

  const [scenarioWidth, setScenarioWidth] = useState(initialWidth);
  const startX = useRef(0);
  const startWidth = useRef(initialWidth);

  const onHandleMouseDown = (event: React.MouseEvent) => {
    startX.current = event.clientX;
    startWidth.current = scenarioWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX.current;
      const nextWidth = Math.min(
        max,
        Math.max(min, startWidth.current + delta),
      );
      setScenarioWidth(nextWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return { scenarioWidth, onHandleMouseDown };
}

import {
  ENERGY_COL_WIDTH,
  NOTES_COL_WIDTH,
  PADDING_COL_WIDTH,
  PLAY_COL_WIDTH,
  RANK_MIN_WIDTH,
  RECOMMEND_COL_WIDTH,
  SCORE_COL_WIDTH,
} from "./detailConstants";

type LeftColumnsInput = {
  scenarioWidth: number;
  showNotesCol: boolean;
  showRecCol: boolean;
  showPlayCol: boolean;
  showHistoryCol: boolean;
};

export type RightGridLayout = {
  templateColumns: string;
  minWidth: number;
};

export function buildLeftColumns(input: LeftColumnsInput): string {
  const {
    scenarioWidth,
    showNotesCol,
    showRecCol,
    showPlayCol,
    showHistoryCol,
  } = input;

  return [
    `${Math.round(scenarioWidth)}px`,
    `${PADDING_COL_WIDTH}px`,
    showNotesCol ? `${NOTES_COL_WIDTH}px` : null,
    showRecCol ? `${RECOMMEND_COL_WIDTH}px` : null,
    showPlayCol ? `${PLAY_COL_WIDTH}px` : null,
    showHistoryCol ? `${PLAY_COL_WIDTH}px` : null,
    `${PADDING_COL_WIDTH}px`,
    `${SCORE_COL_WIDTH}px`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildRightGridLayout(
  visibleRankCount: number,
  hasEnergy: boolean,
): RightGridLayout {
  const rankColumns = Math.max(visibleRankCount, hasEnergy ? 0 : 1);

  const templateColumns = [
    ...Array.from(
      { length: rankColumns },
      () => `minmax(${RANK_MIN_WIDTH}px, 1fr)`,
    ),
    ...(hasEnergy ? [`minmax(${ENERGY_COL_WIDTH}px, 1fr)`] : []),
  ];

  return {
    templateColumns: templateColumns.join(" "),
    minWidth: rankColumns * RANK_MIN_WIDTH + (hasEnergy ? ENERGY_COL_WIDTH : 0),
  };
}

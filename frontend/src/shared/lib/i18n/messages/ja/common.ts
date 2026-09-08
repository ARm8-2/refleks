import type { CommonMessages } from "../en/common";

/**
 * 複数の機能で共有する日本語テキスト。
 */
export const common: CommonMessages = {
  nav: {
    primary: "プライマリ",
    secondary: "セカンダリ",
    overview: "概要",
    history: "履歴",
    benchmarks: "ベンチマーク",
    favorites: "お気に入り",
    help: "ヘルプ",
    support: "サポート",
    settings: "設定",
  },
  actions: {
    cancel: "キャンセル",
    save: "保存",
    saving: "保存中...",
    reset: "リセット",
    delete: "削除",
    deleting: "削除中…",
    close: "閉じる",
    back: "戻る",
    edit: "編集",
    reload: "再読み込み",
    dismiss: "閉じる",
    expand: "展開",
    all: "すべて",
    none: "なし",
    unlimited: "無制限",
  },
  search: "検索...",
  loading: "読み込み中...",
  unknown: "不明",
  yes: "はい",
  no: "いいえ",
  missingValue: "該当なし",
  errorBoundary: {
    title: "問題が発生しました。",
    reload: "再読み込み",
    dismiss: "閉じる",
  },
  widget: {
    expand: "展開",
    noSessionLoaded: "セッションが読み込まれていません",
  },
  dialog: {
    close: "閉じる",
  },
  infoTooltip: {
    ariaLabel: "詳細情報",
  },
};

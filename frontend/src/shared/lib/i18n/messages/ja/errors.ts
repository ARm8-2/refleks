import type { ErrorMessages } from "../en/errors";

/**
 * Goバックエンドが生成するユーザー向けメッセージの日本語訳。
 */
export const errors: ErrorMessages = {
  replay: {
    processing: "リプレイを処理中…",
    ready: "リプレイの準備ができました。",
    noCaptureSession: "このプレイでは画面キャプチャを利用できませんでした。",
    noSessionCoverage:
      "このプレイをカバーするキャプチャセッションがありません。",
    outsideSession: "このプレイは利用可能なキャプチャセッションの範囲外です。",
    captureStopped: "リプレイの処理が完了する前にキャプチャが停止しました。",
    processingFailed: "リプレイの処理に失敗しました。",
    segmentsMissing:
      "キャプチャセグメントがプレイの時間範囲をカバーしていません。",
    trimTimedOut: "キャプチャセグメントの待機がタイムアウトしました。",
    storageUnavailable: "プレイの保存領域が初期化されていません。",
    missing: "このプレイのリプレイはありません。",
    exportFailed: "リプレイのエクスポートに失敗しました。",
  },
  screenCapture: {
    starting: "キャプチャからまだフレームが生成されていません。",
    active: "キャプチャ中です。フレームを受信しています。",
    uninitialized: "画面キャプチャのランタイムが初期化されていません。",
  },
  update: {
    checkFailed: "アップデートの確認に失敗しました。",
    downloadFailed: "アップデートのダウンロードに失敗しました。",
    unsupportedOS: "自動アップデートは現在Windowsでのみ利用できます。",
  },
  autostart: {
    updateFailed: "自動起動の更新に失敗しました。",
  },
  benchmark: {
    progressFetchFailed: "ベンチマークの進捗の読み込みに失敗しました。",
  },
  scenario: {
    scoresFetchFailed:
      "シナリオスコアの読み込みに失敗しました。設定を確認し、「ペルソナ名」が設定されていることを確認してください。",
  },
};

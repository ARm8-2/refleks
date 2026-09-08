import { plural } from "../../plural";
import type { SettingsMessages } from "../en/settings";

/**
 * 設定機能の日本語テキスト。
 */
export const settings: SettingsMessages = {
  page: {
    title: "設定",
    description:
      "一般動作、プライバシー、外観、高度な連携オプションを設定します。",
    loading: "設定を読み込み中...",
  },
  updates: {
    title: "アップデート",
    description:
      "最新バージョンの確認、ウェルカム画面の再表示、現在のリリースの確認ができます。",
    currentVersion: "現在のバージョン:",
    checkForUpdates: "アップデートを確認",
    readWelcomeAgain: "ウェルカムをもう一度読む",
    failedToCheck: "アップデートの確認に失敗しました",
    upToDate: "最新バージョンを使用しています！",
    versionAvailable: "バージョン {version} を利用できます",
    installBannerPrefix: "{version} を使用中です。",
    installBannerSuffix:
      "バックグラウンドでダウンロードするにはクリックしてください。アプリは終了し、インストーラーが自動的に起動します。",
    downloading: "ダウンロード中...",
    installUpdate: "アップデートをインストール",
    viewChangelog: "変更履歴を見る",
    failedToDownload: "アップデートのダウンロードに失敗しました",
  },
  general: {
    title: "一般",
    description: "基本フォルダーとセッションの動作。",
    kovaaksInstallFolder: "KovaaK'sのインストールフォルダー",
    kovaaksInstallFolderDescription:
      "FPSAimTrainer/statsとFPSAimTrainer/performancesの場所を特定するために使用するKovaaK'sのインストールフォルダーのパス",
    startWithKovaaks: "KovaaK'sと一緒に起動",
    startWithKovaaksDescription:
      "KovaaK'sの起動時にRefleK'sを自動的に起動します。RefleK'sはWindowsの起動時にも起動します",
    mouseTracking: "マウストラッキング",
    mouseTrackingDescription:
      "シナリオ中のマウスの動きを記録します（Windowsのみ）",
    bufferDuration: "バッファー時間",
    bufferDurationDescription: "メモリに保持するマウスデータの時間（分）",
    screenCapture: "画面キャプチャ",
    screenCaptureDescription:
      "シナリオ中の画面を記録してビデオリプレイを作成します（Windowsのみ、FFmpegが必要）",
    screenCaptureStatusActive: "画面キャプチャは有効です",
    screenCaptureStatusError: "画面キャプチャエラー",
    screenCaptureStatusUnavailable: "画面キャプチャは利用できません",
    screenCaptureStatusReady: "画面キャプチャの準備ができました",
    screenCaptureEncoder: "{encoder}を使用中",
    screenCaptureHardware: "（ハードウェアアクセラレーション）",
    screenCaptureSoftware: "（ソフトウェア）",
    ffmpegMissingTitle: "FFmpegが見つかりません",
    ffmpegMissingPrefix: "次のファイルを",
    ffmpegMissingSuffix: "の横に配置してください:",
    resolution: "解像度",
    resolutionDescription:
      "新しいキャプチャセッションで使用する解像度。ゲームの実行中に変更すると、キャプチャセッションが直ちに切り替わります",
    resolutionNative: "ネイティブ（モニター解像度）",
    resolution1080: "1080p (1920×1080)",
    resolution900: "900p (1600×900)",
    resolution720: "720p (1280×720)",
    captureFps: "キャプチャFPS",
    captureFpsDescription:
      "新しいキャプチャセッションのフレームレート。ゲームの実行中に変更すると、キャプチャセッションが直ちに切り替わります",
    replayCleanup: "リプレイのクリーンアップ",
    replayCleanupDescription:
      "古いリプレイを自動的に削除して保存容量を制限します。起動時と新しいリプレイの作成後に実行されます",
    replayAgeLimit: "リプレイの保存期間",
    replayAgeLimitDescription:
      "この期間より古いリプレイを削除します。「無制限」で保存期間を制限しません",
    replayAge1d: "1日",
    replayAge2d: "2日",
    replayAge4d: "4日",
    replayAge1w: "1週間",
    replayAge2w: "2週間",
    replayAge1m: "1か月",
    storageLimit: "保存容量の上限",
    storageLimitDescription:
      "リプレイフォルダーがこのサイズを超えたとき、古いリプレイから削除します。「無制限」で保存容量を制限しません",
    storage1gb: "1 GB",
    storage2gb: "2 GB",
    storage5gb: "5 GB",
    storage10gb: "10 GB",
    storage25gb: "25 GB",
    sessionGap: "セッション間隔",
    sessionGapDescription:
      "新しいセッションを開始するまでの非アクティブ時間（分）",
    sessionGapMinutes: plural({ one: "1分", other: "{count}分" }),
  },
  privacy: {
    title: "プライバシー",
    description:
      "プレイをアップロードするか、同期前に識別につながる環境データを削除するかを設定します。",
    runSync: "プレイの同期",
    runSyncDescription: "完了したプレイをRefleK's Indexにアップロードします。",
    anonymousMode: "匿名モード",
    anonymousModeDescription:
      "同期アップロードの前に、プレイの環境データからSteam IDとSteamのペルソナ名を削除します。",
  },
  appearance: {
    title: "外観",
    description: "インターフェースの表示設定。",
    theme: "テーマ",
    themeDescription: "アプリケーションの配色テーマ",
    themeDark: "ダーク",
    themeDarker: "より暗いダーク",
    themeLight: "ライト",
    themeCustom: "カスタム",
    themeCustomDescription:
      "RefleK'sの設定フォルダーにあるカスタムテーマファイルを編集して、色やフォントなどを細かく設定できます。変更は再起動後に反映されます。",
    openThemeFile: "テーマファイルを開く",
    regenerateThemeFile: "再生成",
    themeFileRegenerateConfirm:
      "テーマファイルを再生成しますか？カスタマイズ内容はデフォルトに置き換えられます。",
    themeFileWriteFailed: "カスタムテーマファイルの書き込みに失敗しました。",
    themeFileOpenFailed: "カスタムテーマファイルを開けませんでした。",
    font: "フォント",
    fontDescription: "インターフェースに使用するフォントファミリー",
    scale: "拡大率",
    scaleDescription:
      "インターフェースのサイズ。大きな画面では小さい値にすると、より多くのコンテンツを表示できます",
    language: "言語",
    languageDescription: "アプリケーションのインターフェース言語",
  },
  advanced: {
    title: "高度な設定",
    description: "連携とデータ保持のオプション。",
    show: "高度な設定を表示",
    hide: "高度な設定を隠す",
    steam: "Steam",
    steamInstallDirectory: "Steamのインストール先",
    steamId: "Steam ID",
    steamIdDescription: "サインイン中のSteamアカウントから自動検出されます。",
    personaName: "ペルソナ名",
    personaNameDescription:
      "サインイン中のSteamアカウントから自動検出されます。",
    displayNamePlaceholder: "表示名",
    dataRetention: "データ保持",
    recentRunsWindow: "最近のプレイ期間（日）",
    recentRunsWindowDescription: "過去N日間のプレイのみを読み込んで表示します",
    recentRunsMinCount: "最近のプレイの最小件数",
    recentRunsMinCountDescription:
      "期間内のプレイが少なすぎる場合、この最小件数に達するまで古いプレイを含めます",
  },
  footer: {
    clearCache: "キャッシュをクリア",
    saving: "設定を保存中...",
    unsavedChanges: "未保存の変更",
    allSaved: "すべての変更を保存しました",
    quitApp: "アプリを終了",
  },
  errors: {
    failedToSaveSettings: "設定の保存に失敗しました",
    failedToUpdateAutostart: "自動起動の更新に失敗しました: {message}",
  },
  clearCache: {
    title: "キャッシュをクリア",
    description:
      "解析済みの統計や計算済みランキングを含む、すべてのキャッシュデータを削除します。設定とセッションデータには影響しません。",
    clearing: "クリア中...",
  },
  resetSettings: {
    title: "設定をリセット",
    description: "デフォルトに戻すデータを選択してください:",
    settingsAndConfig: "設定と構成",
    favoriteScenarios: "お気に入りのシナリオ",
    scenarioNotes: "シナリオメモ",
    sessionNotes: "セッションメモ",
    resetting: "リセット中...",
    resetSelected: "選択項目をリセット",
  },
};

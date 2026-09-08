import type { WelcomeMessages } from "../en/welcome";

/**
 * ウェルカム画面の日本語テキスト。
 * 製品名（RefleK's、KovaaK's、Steam、FFmpeg、RefleK's Index）は原文のままです。
 */
export const welcome: WelcomeMessages = {
  content: {
    titleFirstLaunch: "RefleK's v{version}へようこそ",
    titleUpgrade: "RefleK's v{version}へおかえりなさい",
    introFirstLaunch: "RefleK'sをインストールしていただきありがとうございます。変更履歴とドキュメントを確認して、最新の機能や改善点をチェックしましょう。",
    introUpgrade: "おかえりなさい。このリリースの新機能は変更履歴で確認できます。",
    details: "変更点、機能、改善点の詳しい情報は、以下のリンクから変更履歴をご覧ください。最新リリースの情報が常に掲載されています。",
    highlightsTitle: "はじめに",
    highlights: {
      changelog: "変更履歴で、リリースの詳細や機能の更新を確認できます。",
      docs: "ガイド、操作手順、トラブルシューティングはドキュメントをご覧ください。",
      customize: "設定で好みに合わせてRefleK'sをカスタマイズできます。",
      community: "コミュニティに参加して、体験を共有しましょう。",
    },
    linksTitle: "リソース",
    ctaFirstLaunch: "探索を始める",
    ctaUpgrade: "トレーニングに戻る",
    links: {
      docsLabel: "ドキュメントを見る",
      docsDescription: "RefleK'sのセットアップガイド、操作手順、トラブルシューティング。",
      changelogLabel: "変更履歴を読む",
      changelogDescription: "ブラウザーで詳しいリリース履歴とバージョンごとの変更点を確認できます。",
    },
  },
  modal: {
    syncStatusEnabled: "プレイの同期は現在有効です。後からプライバシー設定で変更できます。",
    syncStatusDisabled: "プレイの同期は現在、設定で無効になっています。後で有効にした場合も、この選択が使用されます。",
    sectionFirstTime: "初回セットアップ",
    sectionProfile: "プロフィール設定",
    sectionReview: "設定",
    sectionFirstTimeDescription: "アップロードとマウスの軌跡をどのように開始するか選択します。これらの選択は後から設定で変更できます。",
    sectionProfileDescription: "RefleK's Indexでプレイをどのように表示するか選択します。後からプライバシー設定で変更できます。",
    sectionReviewDescription: "現在の設定を確認します。これらは設定パネルからいつでも変更できます。",
    recommended: "おすすめ",
    later: "後で",
    private: "非公開",
    index: {
      label: "RefleK's Index",
      description: "完了したプレイをRefleK's Indexにアップロードできます。これは世界中のプレイヤーのランキング、比較、研究に活用される共有データセットです。",
    },
    publicProfile: {
      label: "公開プロフィール",
      subtitle: "IndexにSteam名を表示する。",
      description: "アップロードしたプレイにSteam名を表示したい場合におすすめです。",
      bullets: [
        "IndexにアップロードしたプレイにSteam名が表示されます。",
        "後からプライバシー設定で匿名に切り替えられます。",
      ],
    },
    anonymous: {
      label: "匿名",
      subtitle: "身元は非公開、貢献は共有。",
      description: "識別情報をアップロードに含めずにデータを提供したい場合におすすめです。",
      bullets: [
        "アップロード前にSteam IDとペルソナ名が削除されます。",
        "プレイは共有データセット、分析、研究に引き続き役立ちます。",
        "後からプライバシー設定で公開に戻せます。",
      ],
    },
    mouseTraces: {
      label: "マウスの軌跡",
      description: "プレイ中の動きをマウスの軌跡として記録し、後からリプレイや比較ができます。軌跡の記録はプレイ中のパフォーマンスに影響しないよう設計されています。",
      helper: "これは開始時の選択にすぎません。後から一般設定で変更できます。",
      enabled: {
        label: "マウスの軌跡を有効化",
        subtitle: "対応するプレイ中の動きを記録します。",
        description: "最初のセッションから、より詳しい履歴とリプレイ機能を使いたい場合におすすめです。",
        bullets: [
          "プレイ中のパフォーマンスに影響しません。",
          "履歴画面でプレイをリプレイ・比較できます。",
          "一般設定でいつでも無効にできます。",
        ],
      },
      disabled: {
        label: "今は有効にしない",
        subtitle: "軌跡の記録なしで始め、必要なときに有効にします。",
        description: "まずアプリに慣れてから、数セッション後に軌跡を記録するか決めたい場合に適した選択です。",
        bullets: [
          "初回セットアップをシンプルに保てます。",
          "後から一般設定でいつでも軌跡を有効にできます。",
          "それ以外の機能は変わらず利用できます。",
        ],
      },
    },
    screenReplay: {
      label: "画面リプレイ",
      description: "プレイをビデオリプレイとして記録し、アプリ内で照準の位置、動き、判断を直接見返して分析できます。",
      helper: "FFmpegが必要です。後から一般設定で変更できます。",
      enabled: {
        label: "リプレイ記録を有効化",
        subtitle: "プレイ中の画面をキャプチャします（ハードウェアアクセラレーション）。",
        description: "統計やマウスの軌跡と並べてゲームプレイを視覚的に確認したい場合におすすめです。",
        bullets: [
          "ハードウェアGPUエンコードで30 fpsで記録するため、CPUへの影響はありません。",
          "各マッチ後、プレイインスペクターの新しいタブにリプレイが表示されます。",
          "一般設定でいつでも無効にできます。",
        ],
      },
      disabled: {
        label: "記録なしで開始",
        subtitle: "マウストラッキングだけで始め、画面リプレイはいつでも追加できます。",
        description: "まずアプリに慣れてから、後でリプレイ記録を有効にしたい場合に適した、手軽な開始方法です。",
        bullets: [
          "初回セットアップをシンプルに保てます。",
          "マウスの軌跡やその他の機能は引き続き利用できます。",
          "一般設定でいつでも画面キャプチャを有効にできます。",
        ],
      },
    },
    resourcesDescription: "リリースの詳細を知りたい場合も、変更履歴とドキュメントはいつでもクリックひとつで確認できます。",
  },
};

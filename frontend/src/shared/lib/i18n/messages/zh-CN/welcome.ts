import type { WelcomeMessages } from "../en/welcome";

/**
 * 欢迎功能的简体中文文本。
 */
export const welcome: WelcomeMessages = {
  content: {
    titleFirstLaunch: "欢迎使用 RefleK's v{version}",
    titleUpgrade: "欢迎回来，RefleK's v{version}",
    introFirstLaunch:
      "感谢你安装 RefleK's。查看更新日志和文档，快速了解最新功能与改进。",
    introUpgrade: "欢迎回来。查看更新日志，了解此版本有哪些新内容。",
    details:
      "如需详细了解变更、功能和改进，请访问下方链接的更新日志。它始终会随最新版本说明及时更新。",
    highlightsTitle: "快速开始",
    highlights: {
      changelog: "访问更新日志，详细了解版本信息和功能更新。",
      docs: "查看文档，获取指南、操作说明和故障排除帮助。",
      customize: "在设置中自定义偏好，让 RefleK's 更适合你的需求。",
      community: "加入社区，分享你的体验。",
    },
    linksTitle: "资源",
    ctaFirstLaunch: "开始探索",
    ctaUpgrade: "继续使用",
    links: {
      docsLabel: "浏览文档",
      docsDescription: "RefleK's 的设置指南、操作说明和故障排除信息。",
      changelogLabel: "阅读更新日志",
      changelogDescription: "在浏览器中查看完整的版本历史和逐版本说明。",
    },
  },
  modal: {
    syncStatusEnabled:
      "训练同步当前已启用。你可以稍后在隐私设置中更改此项。",
    syncStatusDisabled:
      "训练同步当前已在设置中关闭。如果之后启用，将使用此选择。",
    sectionFirstTime: "首次设置",
    sectionProfile: "个人资料设置",
    sectionReview: "设置",
    sectionFirstTimeDescription:
      "选择上传和鼠标轨迹的启动方式。你可以稍后在设置中更改这些选项。",
    sectionProfileDescription:
      "选择训练在 RefleK's Index 上的显示方式。你可以稍后在隐私设置中更改此项。",
    sectionReviewDescription:
      "查看当前设置。你可以随时在设置面板中更改这些选项。",
    recommended: "推荐",
    later: "稍后",
    private: "私密",
    index: {
      label: "RefleK's Index",
      description:
        "完成的训练可以上传到 RefleK's Index。这是一个共享数据集，为全球玩家群体提供排名、比较和研究数据。",
    },
    publicProfile: {
      label: "公开个人资料",
      subtitle: "在 Index 上显示我的 Steam 名称。",
      description: "如果你希望上传的训练显示 Steam 名称，此选项最适合你。",
      bullets: [
        "你的 Steam 名称会显示在上传到 Index 的训练上。",
        "稍后可以在隐私设置中切换为匿名。",
      ],
    },
    anonymous: {
      label: "匿名",
      subtitle: "隐藏身份，分享贡献。",
      description:
        "如果你希望贡献数据，同时避免在上传内容中包含可识别信息，此选项最适合你。",
      bullets: [
        "上传前会清除 Steam ID 和用户名称。",
        "你的训练仍会帮助共享数据集、分析和研究。",
        "稍后可以在隐私设置中切换回公开。",
      ],
    },
    mouseTraces: {
      label: "鼠标轨迹",
      description:
        "鼠标轨迹会记录训练过程中的移动，让你之后可以回放和比较。轨迹记录的设计目标是在游戏过程中不产生性能影响。",
      helper: "这只是你的初始选择——稍后可以在常规设置中更改。",
      enabled: {
        label: "启用鼠标轨迹",
        subtitle: "记录受支持训练中的移动。",
        description: "如果你希望从第一次会话开始就获得更丰富的历史记录和回放工具，此选项最适合你。",
        bullets: [
          "游戏过程中不会影响性能。",
          "可以在历史记录视图中回放和比较训练。",
          "随时可以在常规设置中关闭。",
        ],
      },
      disabled: {
        label: "暂时不要",
        subtitle: "先不记录轨迹，随时可以启用。",
        description:
          "如果你想先熟悉应用，再在几次会话后决定是否记录轨迹，这是一个不错的开始。",
        bullets: [
          "让首次设置保持简单。",
          "稍后随时可以在常规设置中启用轨迹。",
          "应用的其他功能不受影响。",
        ],
      },
    },
    screenReplay: {
      label: "屏幕回放",
      description:
        "录制训练视频回放，让你可以直接在应用中重新观看和分析准星位置、移动以及决策。",
      helper: "需要 FFmpeg。稍后可以在常规设置中更改。",
      enabled: {
        label: "启用回放录制",
        subtitle: "录制训练过程中的屏幕（硬件加速）。",
        description:
          "如果你希望结合统计数据和鼠标轨迹直观复盘游戏过程，此选项最适合你。",
        bullets: [
          "以 30 fps 录制，并使用硬件 GPU 编码——不占用 CPU。",
          "每场比赛后，回放会作为运行检查器中的新标签页显示。",
          "随时可以在常规设置中关闭。",
        ],
      },
      disabled: {
        label: "暂不录制",
        subtitle: "先仅使用鼠标跟踪，随时添加屏幕回放。",
        description:
          "这是一个轻量的开始方式。熟悉应用后，仍可稍后启用回放录制。",
        bullets: [
          "让首次设置保持简单。",
          "鼠标轨迹和其他功能仍可正常使用。",
          "随时可以在常规设置中启用屏幕捕获。",
        ],
      },
    },
    resourcesDescription:
      "如果你想完整了解版本历程，更新日志和文档始终只需点击一下即可访问。",
  },
};

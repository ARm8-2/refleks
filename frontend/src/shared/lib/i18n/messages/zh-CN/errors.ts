import type { ErrorMessages } from "../en/errors";

/**
 * Go 后端返回的用户可见错误信息的简体中文文本。
 */
export const errors: ErrorMessages = {
  replay: {
    processing: "正在处理回放…",
    ready: "回放已准备就绪。",
    noCaptureSession: "本次训练没有可用的屏幕捕获会话。",
    noSessionCoverage: "没有捕获会话覆盖本次训练。",
    outsideSession: "本次训练发生在可用捕获会话之外。",
    captureStopped: "回放处理完成前，屏幕捕获已停止。",
    processingFailed: "回放处理失败。",
    segmentsMissing: "捕获片段未覆盖训练时间段。",
    trimTimedOut: "等待捕获片段超时。",
    storageUnavailable: "训练存储尚未初始化。",
    missing: "本次训练不存在回放。",
    exportFailed: "导出回放失败。",
  },
  screenCapture: {
    starting: "捕获尚未生成画面。",
    active: "正在捕获并接收画面。",
    uninitialized: "屏幕捕获运行时尚未初始化。",
  },
  update: {
    checkFailed: "检查更新失败。",
    downloadFailed: "下载更新失败。",
    unsupportedOS: "自动更新目前仅支持 Windows。",
  },
  autostart: {
    updateFailed: "更新开机自启设置失败。",
  },
  benchmark: {
    progressFetchFailed: "加载基准训练进度失败。",
  },
  scenario: {
    scoresFetchFailed: "加载场景分数失败。",
  },
};

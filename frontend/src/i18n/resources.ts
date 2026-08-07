import benchmarksEn from "./locales/en/benchmarks.json";
import commonEn from "./locales/en/common.json";
import errorsEn from "./locales/en/errors.json";
import historyEn from "./locales/en/history.json";
import overviewEn from "./locales/en/overview.json";
import settingsEn from "./locales/en/settings.json";
import welcomeEn from "./locales/en/welcome.json";
import benchmarksZhCN from "./locales/zh-CN/benchmarks.json";
import commonZhCN from "./locales/zh-CN/common.json";
import errorsZhCN from "./locales/zh-CN/errors.json";
import historyZhCN from "./locales/zh-CN/history.json";
import overviewZhCN from "./locales/zh-CN/overview.json";
import settingsZhCN from "./locales/zh-CN/settings.json";
import welcomeZhCN from "./locales/zh-CN/welcome.json";

export const resources = {
  en: {
    common: commonEn,
    overview: overviewEn,
    history: historyEn,
    benchmarks: benchmarksEn,
    settings: settingsEn,
    welcome: welcomeEn,
    errors: errorsEn,
  },
  "zh-CN": {
    common: commonZhCN,
    overview: overviewZhCN,
    history: historyZhCN,
    benchmarks: benchmarksZhCN,
    settings: settingsZhCN,
    welcome: welcomeZhCN,
    errors: errorsZhCN,
  },
} as const;

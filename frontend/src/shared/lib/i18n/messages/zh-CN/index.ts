import type { Messages } from "../en";
import { common } from "./common";
import { errors } from "./errors";
import { settings } from "./settings";
import { welcome } from "./welcome";
import { overview } from "./overview";
import { history } from "./history";
import { benchmarks } from "./benchmarks";

/**
 * 简体中文目录。`Messages` 确保与英文参考目录拥有完全一致的键结构。
 */
export const zhCN: Messages = {
  common,
  errors,
  settings,
  welcome,
  overview,
  history,
  benchmarks,
};

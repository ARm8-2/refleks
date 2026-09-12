import type { Messages } from "../en";
import { common } from "./common";
import { errors } from "./errors";
import { settings } from "./settings";
import { welcome } from "./welcome";
import { overview } from "./overview";
import { history } from "./history";
import { benchmarks } from "./benchmarks";

/**
 * 日本語カタログ。`Messages` により、英語の参照カタログと同じキー構造を保証します。
 */
export const ja: Messages = {
  common,
  errors,
  settings,
  welcome,
  overview,
  history,
  benchmarks,
};

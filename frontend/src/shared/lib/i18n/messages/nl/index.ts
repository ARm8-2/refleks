import type { Messages } from "../en";
import { common } from "./common";
import { errors } from "./errors";
import { settings } from "./settings";
import { welcome } from "./welcome";
import { overview } from "./overview";
import { history } from "./history";
import { benchmarks } from "./benchmarks";

/**
 * Dutch catalog. The `Messages` annotation guarantees the exact same key
 * structure as the English reference catalog.
 */
export const nl: Messages = {
  common,
  errors,
  settings,
  welcome,
  overview,
  history,
  benchmarks,
};

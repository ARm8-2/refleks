import { common } from "./common";
import { errors } from "./errors";
import { settings } from "./settings";
import { welcome } from "./welcome";
import { overview } from "./overview";
import { history } from "./history";
import { benchmarks } from "./benchmarks";
import { WidenDeep } from "../types";

/**
 * Reference (English) catalog. `Messages` is the widened shape every other
 * locale must satisfy structurally, which makes a missing or mistyped key in
 * any locale a compile-time error.
 */
export const en = {
  common,
  errors,
  settings,
  welcome,
  overview,
  history,
  benchmarks,
};

export type Messages = WidenDeep<typeof en>;

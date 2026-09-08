import type { Messages } from "../en";
import { common } from "./common";
import { errors } from "./errors";
import { settings } from "./settings";
import { welcome } from "./welcome";
import { overview } from "./overview";
import { history } from "./history";
import { benchmarks } from "./benchmarks";

/**
 * Catálogo en español. La anotación `Messages` garantiza la misma estructura
 * exacta de claves que el catálogo de referencia en inglés.
 */
export const es: Messages = {
  common,
  errors,
  settings,
  welcome,
  overview,
  history,
  benchmarks,
};

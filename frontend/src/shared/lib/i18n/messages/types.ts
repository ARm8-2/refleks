/**
 * Shared message-catalog types.
 *
 * A message is either a plain string (optionally containing `{param}`
 * placeholders resolved by the translator) or a function of the count for
 * pluralized messages. Catalog files should stay plain-object oriented so a
 * translator never has to write functions; the `plural` helper from
 * `../../plural` covers every plural case in this app.
 */
export type MessageValue = string | ((count: number) => string);
export type MessageMap = Record<string, MessageValue>;

/**
 * Deeply widens string literals to `string` while preserving function values.
 *
 * Reference catalogs are typed with literal values (`save: "Save"`), which
 * would make translated values like `save: "Opslaan"` fail structural
 * assignment. Widening keeps the shape (and therefore the missing-key
 * checking) while letting each locale carry its own strings.
 */
export type WidenDeep<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends string
    ? string
    : { [K in keyof T]: WidenDeep<T[K]> };

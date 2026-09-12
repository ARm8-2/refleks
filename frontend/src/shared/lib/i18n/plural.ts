/**
 * Small pluralization helper for catalog files.
 *
 * EN and NL share the same plural rules (1 -> "one", everything else ->
 * "other"), which is all this app needs. When a third locale with different
 * rules lands, extend this helper (or swap it for full CLDR plural support).
 *
 * Counted forms may embed `{count}` and the translator substitutes it:
 *
 *   runs: plural({ one: "1 run", other: "{count} runs" }),
 */
export function plural(forms: { one: string; other: string }) {
  return (count: number): string => (count === 1 ? forms.one : forms.other);
}

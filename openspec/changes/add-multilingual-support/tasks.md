## 1. Typed localization foundation

- [x] 1.1 Add `i18next` and `react-i18next` runtime dependencies plus `vitest`, `@testing-library/react`, and `jsdom` test dependencies; add `test:i18n` and `check:i18n` package scripts.
- [x] 1.2 Create the locale registry and statically bundled `en` and `zh-CN` JSON resources for `common`, `overview`, `history`, `benchmarks`, `settings`, `welcome`, and `errors` namespaces.
- [x] 1.3 Generate a version-controlled i18next declaration from English JSON, including namespace, translation key, and named interpolation parameters; extend `CustomTypeOptions` and make `check:i18n` reject a stale declaration.
- [x] 1.4 Implement the build verifier for locale namespace/key parity, interpolation parity, and statically knowable `t()` and `<Trans>` references, then run it before TypeScript and Vite in `npm run build`.
- [x] 1.5 Implement one-time initial language detection: when Settings has no valid language, map a `navigator.language` primary language of `zh` to `zh-CN` and every other language to `en`; map stored languages to `en-US`/`zh-CN` Intl locales without checking the system again.
- [x] 1.6 Add a controlled rich-text translation pattern using `<Trans>` and tests proving locale resources cannot inject arbitrary HTML.

## 2. Settings ownership and startup ordering

- [x] 2.1 Add an optional language field and `en`/`zh-CN` constants to the Go Settings model and service; represent a missing, empty, or invalid value as uninitialized without exposing it as a selectable language.
- [x] 2.2 Add Go tests for fresh uninitialized settings, pre-language settings migration, valid persisted languages, and invalid language recovery.
- [x] 2.3 Regenerate Wails bindings and update the handwritten frontend Settings type with an optional `en | zh-CN` language field.
- [x] 2.4 Refactor the Settings save queue to serialize complete snapshots from the latest local Settings state and track the last successfully committed state.
- [x] 2.5 Add frontend tests covering queued older snapshots, language save success, language save failure rollback, later setting edits, and prevention of stale overwrites.
- [x] 2.6 Refactor frontend bootstrap to read Settings before mounting React, persist a detected initial `en` or `zh-CN` when language is uninitialized, initialize i18next, and set the root HTML `lang`; use English for the current session without overwriting Settings when the read fails or times out.
- [x] 2.7 Add a Settings language control containing only English and Simplified Chinese, with native language names, disabled-while-saving behavior, persist-before-apply switching, localized failure, and rollback to the committed language.
- [x] 2.8 Make Reset Settings drain the save queue, preserve the committed language, reload complete Settings, and reapply theme, font, and language together; add a test proving reset does not inspect or follow the operating system language.

## 3. Formatting, terminology, and typography

- [x] 3.1 Implement `useLocaleFormat` and shared date, time, number, duration, weekday, month, plural, and collator factories driven by the current language's explicit Intl locale.
- [x] 3.2 Preserve existing timestamp time-zone meaning, number scaling, precision, units, and source-data comparators while moving display formatting behind the shared formatter.
- [x] 3.3 Add deterministic formatter tests with fixed inputs and time zone, covering `en-US`, `zh-CN`, language switching, translated-label sorting, and unchanged source values.
- [x] 3.4 Encode the approved English/Simplified Chinese terminology table in locale resources and review every repeated core term against it.
- [x] 3.5 Add `zh-CN` body and monospace font fallbacks for Microsoft YaHei UI, Microsoft YaHei, and Noto Sans CJK SC without bundling a new CJK font asset.
- [x] 3.6 Verify Chinese punctuation while preserving brand names, technical names, paths, versions, shortcuts, unit symbols, and interpolated source values.

## 4. Feature text migration

- [x] 4.1 Migrate shared components, ErrorBoundary actions, common controls, validation copy, tooltips, dialogs, notifications, empty states, and loading states to `common` and `errors` semantic keys.
- [x] 4.2 Migrate application layout, Sidebar navigation, external-resource actions, and route labels to semantic keys.
- [x] 4.3 Migrate the complete Welcome and first-time setup flow, including rich content, to the `welcome` namespace.
- [x] 4.4 Migrate Settings sections, fields, descriptions, generated option labels, reset flow, save states, update flow, and feedback messages to the `settings` namespace.
- [x] 4.5 Migrate Overview pages, widgets, chart labels, empty states, and fixed `en-US` formatters to the `overview` namespace and shared formatter.
- [x] 4.6 Migrate History pages, filters, session/run inspectors, charts, Replay UI, empty states, and fixed `en-US` formatters to the `history` namespace and shared formatter.
- [x] 4.7 Migrate Benchmarks explore/detail pages, filters, progress widgets, recommendations, table labels, and fixed `en-US` formatters to the `benchmarks` namespace and shared formatter.
- [x] 4.8 Audit remaining frontend literals and classify each as translated fixed UI, preserved source/domain data, or technical logging; remove every unclassified user-visible English literal.

## 5. Structured user-message boundary

- [x] 5.1 Add shared Go and TypeScript contracts for `messageCode` plus optional primitive `messageParams`, with codes constrained to the `<domain>.<reason>` convention.
- [x] 5.2 Convert Replay status storage, query results, fallback statuses, and `replay:status` events to the identical structured message contract and add Go tests for representative states.
- [x] 5.3 Map internal Screen Capture diagnostics to an App-facing structured status DTO and stop serializing raw `lastError` to the frontend.
- [x] 5.4 Implement the frontend message translator with typed known codes, interpolation, logging for missing/unknown codes, and `errors:generic.unexpected` fallback.
- [x] 5.5 Replace raw Wails rejection text in alerts, toasts, update actions, Replay export, Benchmark operations, and other visible call sites with operation-specific localized generic errors while retaining full console/Go diagnostics.
- [x] 5.6 Refactor ErrorBoundary so production renders no raw message or stack, development exposes diagnostics only in a marked detail view, and both modes retain localized recovery controls.

## 6. Isolated acceptance and final verification

- [x] 6.1 Add repository-owned sanitized KovaaK's fixtures covering empty and populated History, dates, numbers, long labels, and Replay unavailable state.
- [x] 6.2 Add an acceptance launcher that creates temporary `USERPROFILE` and `HOME`, points `REFLEKS_KOVAAKS_INSTALL_DIR` at the fixtures, and proves the developer's real settings and game data are untouched.
- [x] 6.3 Add component tests with typed DTO fixtures for processing, failed, unknown-message, persistence-failure, and production ErrorBoundary states that cannot be triggered deterministically through training files.
- [x] 6.4 Capture the full English and Simplified Chinese screenshot matrix at `1500x900` and `1024x720` with 100 percent scaling for Sidebar, Welcome, Settings basic/advanced, Overview, History list/detail, Replay, Benchmarks list/detail, and generic error UI.
- [x] 6.5 Inspect screenshots for required text visibility, overlap, chart label readability, long-text wrapping, mixed-font alignment, missing glyphs, and stable control dimensions; retain failure artifacts for diagnosis.
- [x] 6.6 Run `check:i18n`, frontend tests, `npm run build`, `go test ./...`, and `wails build`, and confirm the Windows executable is produced.
- [x] 6.7 Run `git diff --check` and OpenSpec strict validation, then review the final diff for generated-file noise, invalid translation references, terminology drift, and untranslated fixed UI copy.

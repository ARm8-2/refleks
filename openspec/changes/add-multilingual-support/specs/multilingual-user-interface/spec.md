## ADDED Requirements

### Requirement: Persisted language selection
The application SHALL persist only `en` or `zh-CN` as the selected language in Go-managed settings. A missing, empty, or invalid field SHALL represent an uninitialized state and SHALL NOT be exposed as a language option.

#### Scenario: Fresh installation
- **WHEN** the application creates settings before a language has been initialized
- **THEN** the language field is absent or empty and no third language value is stored

#### Scenario: Existing settings without language
- **WHEN** the application loads a settings file created before language support
- **THEN** it preserves every existing setting and treats language as uninitialized

#### Scenario: Invalid stored language
- **WHEN** the application loads a language value other than `en` or `zh-CN`
- **THEN** it treats language as uninitialized instead of exposing or retaining the invalid value

#### Scenario: User-visible language options
- **WHEN** the Settings language selector is displayed
- **THEN** it contains only English and Simplified Chinese and has no system-following option

### Requirement: One-time initial language detection
The application SHALL inspect the operating system language only when no valid language has been stored, and SHALL initialize the selected language before rendering the React interface.

#### Scenario: Initial Chinese language detection
- **WHEN** language is uninitialized and the primary language of `navigator.language` is `zh`
- **THEN** the application selects and persists `zh-CN`

#### Scenario: Initial non-Chinese language detection
- **WHEN** language is uninitialized and the primary language of `navigator.language` is not `zh`
- **THEN** the application selects and persists `en`

#### Scenario: Regional Chinese language tag
- **WHEN** language is uninitialized and `navigator.language` is `zh-TW`, `zh-HK`, `zh-CN`, or another tag whose primary language is `zh`
- **THEN** the application selects `zh-CN`; regional Chinese variants are not separate supported languages

#### Scenario: Stored English
- **WHEN** the stored language is `en`
- **THEN** the application uses English without inspecting or following the operating system language

#### Scenario: Stored Simplified Chinese
- **WHEN** the stored language is `zh-CN`
- **THEN** the application uses Simplified Chinese without inspecting or following the operating system language

#### Scenario: Initial language persistence fails
- **WHEN** language is uninitialized and persisting the detected language fails
- **THEN** the application uses the detected language for the current session, logs the failure, and leaves language uninitialized so a later startup can retry

#### Scenario: Settings cannot be read during startup
- **WHEN** the frontend cannot read persisted settings, or the read does not complete within one second, before React initialization
- **THEN** it uses English for the current session, logs the failure, and does not overwrite the language that may already exist on disk

### Requirement: Complete bundled language resources
The application SHALL bundle complete English and Simplified Chinese resources for all fixed user-visible interface text without fetching language resources over the network.

#### Scenario: Application runs offline
- **WHEN** the application starts without network access
- **THEN** both English and Simplified Chinese interface resources remain available

#### Scenario: Resource structures diverge
- **WHEN** a locale has a missing key, an extra key, or different interpolation variables from the English resource
- **THEN** the language resource verification command fails

#### Scenario: Runtime key is unavailable
- **WHEN** a requested key is unavailable in the current language
- **THEN** the application uses the English resource for that key

#### Scenario: Code references an invalid static key
- **WHEN** frontend code references a statically knowable translation key that does not exist in the English resource contract
- **THEN** TypeScript or the language resource verification command fails before the production build

#### Scenario: Localized rich text
- **WHEN** translated content contains links, emphasis, code, or controlled line breaks
- **THEN** the application composes it with controlled React components and does not render HTML supplied by a language resource

### Requirement: Immediate language switching
The application SHALL apply a successfully saved language without requiring an application restart.

#### Scenario: User changes language
- **WHEN** the user selects a different language and settings persistence succeeds
- **THEN** visible fixed text and locale-sensitive formatting update to the selected language in the current session

#### Scenario: Language persistence fails
- **WHEN** the user selects a different language and settings persistence fails
- **THEN** the current language and selector return to the last successfully persisted language and the application displays a localized save failure

#### Scenario: Document language changes
- **WHEN** the current language changes
- **THEN** the application updates the root HTML `lang` attribute to the selected language tag

#### Scenario: Other settings are queued during a language change
- **WHEN** complete Settings snapshots are waiting in the save queue while the user changes language
- **THEN** all saves remain serialized from the latest local snapshot and no earlier snapshot can overwrite the successfully persisted language or other newer settings

#### Scenario: Settings are reset
- **WHEN** the user resets configuration settings
- **THEN** the application drains the save queue, preserves the last successfully persisted language, invokes the existing backend reset, reloads the complete persisted Settings, and applies the reset theme, font, and language together

#### Scenario: Reset does not repeat detection
- **WHEN** Reset Settings completes after the operating system language has changed
- **THEN** the application keeps the previously persisted `en` or `zh-CN` selection and does not inspect the operating system language again

#### Scenario: Reset fails after queued changes
- **WHEN** a reset or the reload after reset fails
- **THEN** the application does not partially apply reset values, preserves the last successfully committed Settings and language, and displays a localized reset failure

### Requirement: Localized fixed interface text
The application SHALL translate all code-owned fixed user-visible text through stable semantic resource keys.

#### Scenario: Fixed-text migration audit
- **WHEN** the localization migration is verified
- **THEN** a repository check scans all production TypeScript and TSX files under `frontend/src` for code-owned user-visible literals in rendered text, accessibility labels, titles, placeholders, validation messages, notifications, dialogs, and tooltips, and every reported literal is either replaced by a semantic resource key or recorded in a reviewed allowlist

#### Scenario: Allowed non-translated literals
- **WHEN** the migration audit encounters a literal that is not translated
- **THEN** it is allowed only when it is a brand or technical name, URL or protocol value, file path or version format, source-owned or external content, test fixture data, or a technical log, and the allowlist identifies its reason and owning file

#### Scenario: Migration audit is complete
- **WHEN** the migration audit runs after all feature modules are migrated
- **THEN** it fails on any unclassified user-visible literal and reports the file and source location so the migration cannot be declared complete by manual inspection alone

#### Scenario: English interface
- **WHEN** the current language is `en`
- **THEN** navigation, pages, dialogs, controls, empty states, validation messages, tooltips, and notifications display English resources

#### Scenario: Simplified Chinese interface
- **WHEN** the current language is `zh-CN`
- **THEN** navigation, pages, dialogs, controls, empty states, validation messages, tooltips, and notifications display Simplified Chinese resources

#### Scenario: Message contains dynamic values
- **WHEN** a localized message includes a count, name, duration, path, or other dynamic value
- **THEN** the application uses named interpolation and locale-aware plural rules rather than string concatenation

### Requirement: Locale-aware value formatting
The application SHALL format display-only dates, times, numbers, durations, weekdays, months, and plural quantities using the current language.

#### Scenario: Language changes with formatted content visible
- **WHEN** the current language changes while a page displays locale-sensitive values
- **THEN** those values re-render using the new language without changing their underlying data

#### Scenario: English date and number formatting
- **WHEN** the current language is `en`
- **THEN** dates and numbers use the English locale conventions defined by the shared formatter

#### Scenario: Simplified Chinese date and number formatting
- **WHEN** the current language is `zh-CN`
- **THEN** dates and numbers use Simplified Chinese locale conventions defined by the shared formatter

#### Scenario: Intl locale mapping
- **WHEN** the current language is `en` or `zh-CN`
- **THEN** the shared formatter uses `en-US` or `zh-CN` respectively as the explicit Intl locale

#### Scenario: Formatting preserves value semantics
- **WHEN** a date, timestamp, score, percentage, file size, duration, or chart value is localized
- **THEN** the application preserves its existing time-zone meaning, scaling, precision, unit, sort value, and source data while changing only presentation conventions

#### Scenario: Translated labels are sorted
- **WHEN** code-owned translated labels require alphabetical sorting
- **THEN** the application uses an `Intl.Collator` created for the current language's Intl locale

#### Scenario: Source-owned names are sorted
- **WHEN** scenario names, Benchmark names, player content, or other source-owned values are sorted
- **THEN** the application retains the existing stable business comparator instead of changing order with the interface language

### Requirement: Localized user-facing errors
The application SHALL translate known user-facing failures from stable message codes and SHALL NOT display raw technical error text as interface copy.

#### Scenario: Known backend status
- **WHEN** a Replay or Screen Capture status exposed to the interface contains a `<domain>.<reason>` message code and primitive string, number, or boolean parameters
- **THEN** the frontend displays the corresponding localized error resource with those parameters

#### Scenario: Replay status event and query
- **WHEN** Replay status is returned by a query or emitted through the `replay:status` event
- **THEN** both paths expose the same `messageCode` and `messageParams` contract

#### Scenario: Unknown technical error
- **WHEN** an operation fails with an error that has no user-facing message code
- **THEN** the frontend logs the technical detail and displays a localized generic failure message

#### Scenario: Unknown message code
- **WHEN** the frontend receives a missing or unknown message code
- **THEN** it logs the code and parameters and displays `errors:generic.unexpected`

#### Scenario: Screen capture diagnostic
- **WHEN** Screen Capture records a raw encoder, D3D, or FFmpeg error
- **THEN** the raw error remains in technical logs and is not serialized as user-visible `lastError`

#### Scenario: Production error boundary
- **WHEN** an unhandled frontend error reaches ErrorBoundary in a production build
- **THEN** the interface shows localized recovery controls without rendering the raw message or JavaScript and component stacks

#### Scenario: Development error boundary
- **WHEN** an unhandled frontend error reaches ErrorBoundary in a development build
- **THEN** the application logs the error and may expose raw diagnostics only inside an explicitly marked development detail view

#### Scenario: Backend logging
- **WHEN** the backend records diagnostic or operational information
- **THEN** the log remains technical English and is not treated as translatable interface content

### Requirement: Preserve domain and external content
The application MUST preserve source-owned names and user data instead of translating them as interface resources.

#### Scenario: Domain data is displayed
- **WHEN** the interface displays a KovaaK's scenario name, Benchmark official name, rank, category, player name, file path, version, or user-authored content
- **THEN** it displays the original value unchanged

#### Scenario: External text is displayed
- **WHEN** the interface displays text supplied by a server or external data file
- **THEN** it preserves that content unless the value is an explicitly documented stable message code

### Requirement: Consistent terminology and Chinese typography
The Simplified Chinese resources SHALL use the approved product glossary and explicit CJK font fallback instead of feature-local terminology choices or implicit glyph fallback.

#### Scenario: Core term is translated
- **WHEN** fixed UI copy uses Run, Session, Scenario, Benchmark, Rank, Score, Replay, Mouse Trace, Screen Capture, or Anonymous Mode
- **THEN** it uses the glossary translation defined by the technical design in every namespace

#### Scenario: Brand or technical name is displayed
- **WHEN** fixed UI copy includes RefleK's, RefleK's Index, Steam, KovaaK's, FFmpeg, a resolution, or an encoder name
- **THEN** that brand or technical name remains unchanged

#### Scenario: Chinese text is rendered
- **WHEN** the current language is `zh-CN`
- **THEN** body and monospace font stacks include the approved Simplified Chinese system fallbacks and required text renders without missing glyphs or incoherent mixed-font layout

#### Scenario: Chinese sentence contains punctuation and dynamic values
- **WHEN** a Simplified Chinese resource contains punctuation, paths, versions, units, shortcuts, or interpolated values
- **THEN** the sentence uses Chinese punctuation while preserving the literal characters of paths, versions, units, shortcuts, and interpolated source values

### Requirement: Multilingual verification
The implementation SHALL provide automated and visual verification for the supported languages.

#### Scenario: Frontend production build
- **WHEN** the frontend production build runs
- **THEN** it verifies locale resource parity before TypeScript and Vite compilation

#### Scenario: Settings and locale unit tests
- **WHEN** automated tests run
- **THEN** they cover uninitialized settings, one-time initial detection and persistence, saved-language reuse, save-queue ordering and rollback, typed-key and fallback behavior, message DTOs, and shared locale formatting

#### Scenario: Key pages are visually checked
- **WHEN** multilingual acceptance verification is performed
- **THEN** Sidebar, Welcome, Settings, Overview, History, Replay, Benchmarks, and the generic error interface are checked in both English and Simplified Chinese at `1500x900` and `1024x720` with 100 percent device scaling and without incoherent overlap, missing glyphs, or clipped required text

#### Scenario: Acceptance data is prepared
- **WHEN** multilingual browser acceptance starts
- **THEN** it launches the application with temporary `USERPROFILE` and `HOME` directories plus a repository-owned sanitized Kovaak's fixture selected through `REFLEKS_KOVAAKS_INSTALL_DIR`

#### Scenario: Acceptance environment is isolated
- **WHEN** multilingual browser acceptance runs or finishes
- **THEN** it does not read or modify the developer's real RefleK's settings, Steam installation, KovaaK's installation, or training records

#### Scenario: Acceptance states are covered
- **WHEN** the screenshot matrix runs
- **THEN** it covers first-run, empty, populated History, dynamic date and number, Replay unavailable, long-text, Settings basic and advanced, and page detail states, while typed component tests cover processing, failed, and other states that real fixtures cannot trigger deterministically

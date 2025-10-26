# RefleK's — Kovaak's analytics, sessions, and mouse trace

RefleK's is a local desktop app (Wails: Go + React) that watches your Kovaak's exported CSV stats, turns them into useful insights, groups scenarios into sessions, and—on Windows—captures a time‑aligned mouse trace you can visualize and study.

Everything runs on your machine. The only network call happens when you open Benchmarks to fetch your player progress from Kovaak's API.


## Highlights

- Live watcher: monitors your Kovaak's stats folder and streams new plays into the UI.
- Sessions view: groups scenarios by time gap so you can analyze whole practice sessions.
- Analytics: accuracy, real average TTK, trends, and charts tailored to Kovaak's.
- Windows mouse trace: optional raw‑input capture per scenario, persisted and reloadable.
- Benchmarks: embedded benchmark catalog plus your progress fetched from Kovaak's.


## Get started (Dev Container recommended)

The fastest way is to open this repo in a VS Code Dev Container or GitHub Codespace. The container has Go, Node.js, Wails, and common tools preinstalled.

1) Open in a Dev Container (or Codespace)
   - In VS Code, use: “Dev Containers: Reopen in Container”
   - For Codespaces: “Create New Codespace” for this repo

2) Run the app in dev
   - Use the VS Code task: “Wails: Dev” (Terminal → Run Task)
   - Or run manually:
     ```bash
     wails dev
     ```

3) Point the watcher at your stats
   - In the app, open Settings and set the Stats directory to where Kovaak's exports CSVs
   - To try it quickly, use the sample data in this repo: `testdata/stats/`

Optional: preview the static landing site with the “Serve Landing (static)” task, then open http://localhost:8080/


## Local setup (optional)

If you’re not using a Dev Container, install these locally:

- Go 1.23+
- Node.js 18+ and npm
- Wails v2 CLI on your PATH

Then run `wails dev` from the repo root.


## Build

- Windows (cross‑compile from Linux/macOS in the container): run the “Wails: Build for Windows” task
- Host platform: `wails build`

Windows artifacts and installer scripts live under `build/windows/`.


## Project overview

- Backend (Go, Wails)
  - `internal/watcher` — polls for new stats, emits ScenarioAdded/Updated events
  - `internal/parser` — parses Stats.csv + derives metrics
  - `internal/mouse` — Windows raw‑input tracker (no‑op elsewhere)
  - `internal/traces` — persists per‑scenario JSON (e.g., mouse trace) under `$HOME/.refleks/traces`
  - `internal/settings` — settings file at `$HOME/.refleks/settings.json`
  - `internal/benchmarks` — embedded data + player progress (via Kovaak's API)
- Frontend (React + Vite + Tailwind)
  - Pages: Scenarios, Sessions, Benchmarks, Settings
  - Auto‑generated bindings live in `frontend/wailsjs/`


## Sample data and filenames

- Sample CSVs: `testdata/stats/`
- Filenames like: `VT … - Challenge - 2025.10.02-18.36.37 Stats.csv`

Derived fields you’ll see in the UI:
- Date Played — from filename timestamp (ISO)
- Accuracy — Hit Count / (Hit Count + Miss Count)
- Real Avg TTK — average time between consecutive kill events (seconds)


## Privacy and SteamID note

Parsing and analytics happen locally. When you open Benchmarks, the app calls Kovaak's player‑progress endpoint using your SteamID. On Windows, the SteamID is auto‑detected from Steam’s `loginusers.vdf`. You can also set it via the `REFLEKS_STEAM_ID` environment variable.


## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and coding guidelines.


## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

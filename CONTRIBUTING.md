# Contributing to RefleK's

Thanks for your interest—your help makes this project better. This guide keeps things simple and stable over time.


## Ways to contribute

- Report bugs and request features
- Improve docs (README, comments, examples)
- Try the app and share feedback
- Contribute code (small, focused PRs are best)


## Asking questions or giving feedback

Open a GitHub Issue for questions or general feedback. Use a clear title and a short description of your question or suggestion. Screenshots or short clips help. If you are reporting a bug, please include steps to reproduce and the expected vs. actual behaviour (see "Reporting issues" below).


## Reporting issues

Please include:
- Windows version (e.g. Windows 10/11). This project targets Windows; please test and report issues on Windows when possible.
- Steps to reproduce (1, 2, 3…)
- Expected vs. actual result
- A sample `… Stats.csv` (and/or trace file) if relevant
- (Optional) Any environment overrides you used: the app loads a `.env` file from `$HOME/.refleks/.env` or from the current working directory. You can set values such as `REFLEKS_STATS_DIR` or `REFLEKS_STEAM_ID` — redact secrets before pasting.


## Development setup (Dev Container recommended)

Use a VS Code Dev Container or GitHub Codespace to avoid local setup:
1) Open the repo in a Dev Container (or Codespace)
2) Run the “Wails: Dev” task to start the app
3) Configure the stats directory

- In the app: open Settings → set the Stats directory. For a quick demo, try `testdata/stats/`.
- Or set an environment override via a `.env` file. The app loads `$HOME/.refleks/.env` first, then a `.env` in the repository working directory when running in dev. Example `.env` (repo root):

```
REFLEKS_STATS_DIR=testdata/stats
REFLEKS_STEAM_ID=<your_steam_id_optional>
```

Optional: run “Serve Landing (static)” to preview the static site at http://localhost:8080/

Not using a container? Install Go 1.23+, Node.js 18+ (with npm), and the Wails v2 CLI locally, then run `wails dev`.


## Pull requests

Keep PRs small and well‑scoped. In your description, mention the user impact and any UI changes. We keep the checklist short:

Required before merge:
- Windows build succeeds (use the “Wails: Build for Windows” task or CI)
- App is manually tested on Windows (basic flows: watch stats, Sessions/Benchmarks open)

Nice to have:
- Docs updated if behavior changed

Note: You don’t need to manually regenerate Wails bindings—`wails dev/build` handles it. If bindings change, commit the generated `frontend/wailsjs/` updates.


## Code of Conduct

Be kind, constructive, and respectful. Assume good intent. If something isn’t clear, open an issue and we’ll figure it out together.


## Thank you

Your contributions—large or small—are appreciated!

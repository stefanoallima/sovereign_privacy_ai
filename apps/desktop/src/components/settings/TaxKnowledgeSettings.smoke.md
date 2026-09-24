# TaxKnowledgeSettings — Smoke Test

This component does not yet have an automated test because the desktop app does not have Vitest configured. When Vitest + @testing-library/react are added (tracked separately), promote `TaxKnowledgeSettings.test.tsx.skip` to `.test.tsx` and run.

Until then, run the manual smoke test below before each release.

## Manual smoke test

1. `cd apps/desktop && pnpm tauri dev` and wait for the window.
2. Click the gear icon (Settings) — the SettingsDialog opens.
3. In the left rail, confirm a "Tax Knowledge" tab appears between "Knowledge Bases" and "Shared Context".
4. Click "Tax Knowledge" — the panel renders with:
   - Heading "Tax Knowledge".
   - Two pill buttons: "Knowledge Base" (active by default) and "Request Analyzer".
   - Below the pills: the heading "Dutch Tax Knowledge Base" with a search input.
5. Type `hypotheekrenteaftrek` into the search box. The list filters down to that concept (or "No concepts found …" if the seed list does not include it — that is acceptable; the path is reachable).
6. Click "Request Analyzer". The panel switches to the analyzer with a "Paste the email or message from your accountant…" textarea.
7. Close the dialog. No console errors.

## Acceptance

- AC1 (≤ 2 clicks): Settings (1) → Tax Knowledge (2). ✓
- AC2 (analyzer reachable): step 6. ✓
- AC6 (objective 1 reachable): step 5. ✓

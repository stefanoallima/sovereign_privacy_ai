# Tasks: PII Vault UI

**ID:** green_pii-vault-ui_05  
**Size:** M (Medium)  
**Total Tasks:** 10  
**Estimated Duration:** 5 business days

---

## Dependency Graph

```
T01 (Setup store methods)
├── T02 (VaultBrowser component)
│   ├── T03 (VaultList component)
│   ├── T04 (VaultEntryModal component)
│   └── T05 (Export/Import functionality)
└── T06 (Integration into PrivacySettings.tsx)
    └── T07 (Search & filter logic)

T08 (Redaction integration verification) [depends on T01, T02]
T09 (Manual end-to-end testing) [depends on T01-T07]
T10 (Regression testing) [depends on T09]
```

**Parallelizable Tasks:**
- T02, T03, T04, T05 can run in parallel after T01
- T06 and T07 can run together
- T08, T10 can run in parallel with T09

---

## Task Breakdown

## T01 — Update Zustand Store Methods

**Description:** Add `updateEntry`, `exportEntries`, and `importEntries` methods to `usePiiVaultStore`. These are needed for edit, export, and future import functionality.

**Files:** 
- apps/desktop/src/stores/piiVault.ts

**Dependencies:** None

**SharedFiles:** 
- None (store is foundational)

**Effort:** S

**Acceptance:**
- [ ] `updateEntry(id, text, category)` method exists and updates entry text/category while preserving ID
- [ ] `exportEntries()` method returns array of all entries as-is (no encryption in export)
- [ ] `importEntries(entries)` method can merge imported entries (prevents duplicates)
- [ ] All methods are type-safe and properly integrated with Zustand
- [ ] Tests pass for store methods (if unit tests exist)

---

## T02 — VaultBrowser Parent Component

**Description:** Create the main container component for Vault UI. Manages state for modal open/close, search/filter, and action handlers. Renders header with stats badge, search bar, list area, and action buttons.

**Files:** 
- apps/desktop/src/components/settings/VaultBrowser.tsx (new)

**Dependencies:** T01 (uses updated store methods)

**SharedFiles:** 
- apps/desktop/src/stores/piiVault.ts (reads from store)
- apps/desktop/src/types/index.ts (PiiVaultEntry type)

**Effort:** M

**Acceptance:**
- [ ] Component renders without errors
- [ ] Vault header displays entry count badge
- [ ] Privacy message is visible: "Stored on your machine, encrypted locally. Never transmitted."
- [ ] Search input is functional (state management, debouncing)
- [ ] Filter buttons for categories exist and work
- [ ] Action buttons (Export, Clear All) are visible and clickable
- [ ] Modal open/close state is managed correctly
- [ ] Empty state message displays when no entries exist

---

## T03 — VaultList Component (Table View)

**Description:** Create the list/table component that displays all vault entries. Shows Value (masked), Type, Count, Date Added, and Actions menu. Handles hover effects, masked value reveal on hover, and responsive layout.

**Files:** 
- apps/desktop/src/components/settings/VaultList.tsx (new)

**Dependencies:** T02 (receives filtered entries as props)

**SharedFiles:** 
- apps/desktop/src/types/index.ts (PiiVaultEntry type)
- Styling: follow existing table patterns from CustomRedactionTerms section in PrivacySettings.tsx

**Effort:** M

**Acceptance:**
- [ ] Table renders with columns: Value, Type, Count, Date Added, Actions
- [ ] Values are masked by default (e.g., "Ac***"), revealed on hover
- [ ] Type badge shows category (e.g., "Company Name", "Person")
- [ ] Count column shows use count (number of redactions)
- [ ] Date Added is formatted as "Mon DD, YYYY"
- [ ] Actions menu (three-dot icon) opens on hover
- [ ] Empty state: "No PII vault entries yet..." message is clear
- [ ] Table is scrollable for 500+ entries (basic scrolling, no virtualization required for v1)
- [ ] Responsive on mobile (switches to card view if screen < 768px)

---

## T04 — VaultEntryModal Component

**Description:** Create a modal dialog showing full entry details with tabs for View, Edit, and Preview. Includes form validation, confirmation dialogs for edit/delete, and proper error handling.

**Files:** 
- apps/desktop/src/components/settings/VaultEntryModal.tsx (new)

**Dependencies:** T01 (uses `updateEntry` and `removeEntry` from store)

**SharedFiles:** 
- apps/desktop/src/stores/piiVault.ts (write operations)
- apps/desktop/src/types/index.ts (PiiVaultEntry type)

**Effort:** L

**Acceptance:**
- [ ] Modal opens with entry details (Value, Type, Placeholder, Count, Date Added)
- [ ] Details tab is read-only display
- [ ] Edit tab allows user to modify Value and Type (dropdown: Company, Person, Email, Phone, Amount, Medication, Custom)
- [ ] Edit form validates non-empty Value before save
- [ ] Preview tab shows how entry appears in redaction (e.g., "[VAULT_COMPANY_1]")
- [ ] Save button calls `updateEntry()` and closes modal
- [ ] Delete button shows confirmation dialog
- [ ] Delete confirmation requires user confirmation before removing
- [ ] Close (X) button closes modal without saving
- [ ] Error handling if store operations fail

---

## T05 — Export/Import Functionality

**Description:** Implement export as JSON file download and (future) import from JSON. Uses Tauri file dialog and fs APIs. Includes confirmation dialog with security warnings.

**Files:** 
- apps/desktop/src/components/settings/ExportDialog.tsx (new)
- apps/desktop/src/components/settings/VaultBrowser.tsx (integrate export handler)

**Dependencies:** T01, T02 (needs store and parent context)

**SharedFiles:** 
- apps/desktop/src/stores/piiVault.ts (exportEntries method)
- Tauri plugins: @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs

**Effort:** M

**Acceptance:**
- [ ] Export button in VaultBrowser triggers ExportDialog
- [ ] ExportDialog shows entry count and estimated file size
- [ ] ExportDialog displays security warning: "File contains unencrypted PII values"
- [ ] Export JSON button triggers file picker (Tauri dialog)
- [ ] File is saved to Downloads folder with timestamp (pii-vault-YYYY-MM-DD-HHmmss.json)
- [ ] Exported JSON has correct structure: array of PiiVaultEntry objects
- [ ] Toast notification shows "Vault exported successfully" after download
- [ ] (Future) Import button is visible but disabled in v1 with note "Coming soon"
- [ ] Error handling if file write fails

---

## T06 — Integration into PrivacySettings.tsx

**Description:** Add the VaultBrowser component into PrivacySettings.tsx as a new section (after Custom Redaction Terms, before Default Privacy Mode). Wire up the component to display within the privacy panel.

**Files:** 
- apps/desktop/src/components/settings/PrivacySettings.tsx (modify)

**Dependencies:** T02, T03, T04, T05 (all vault components must exist)

**SharedFiles:** 
- None (purely integration)

**Effort:** S

**Acceptance:**
- [ ] VaultBrowser is imported and rendered in PrivacySettings
- [ ] VaultBrowser appears as a new section with header card styling (matching existing sections)
- [ ] Styling matches other privacy sections (border, padding, background)
- [ ] No layout breaks or overflow issues
- [ ] Responsive on mobile (section scales appropriately)

---

## T07 — Search & Filter Logic

**Description:** Implement real-time search by value text and category filter. Debounce search input (300ms) to avoid excessive re-renders. Wire up quick-filter category buttons.

**Files:** 
- apps/desktop/src/components/settings/VaultBrowser.tsx (enhance)

**Dependencies:** T02 (integrates into VaultBrowser)

**SharedFiles:** 
- None

**Effort:** S

**Acceptance:**
- [ ] Search input filters entries by text (case-insensitive)
- [ ] Search is debounced (300ms) to avoid lag with 500+ entries
- [ ] Category filter buttons (All, Names, Amounts, Medication, Custom) work correctly
- [ ] Combining text search + category filter works (AND logic)
- [ ] VaultList updates in real-time as user types
- [ ] Clearing search/filter shows all entries again
- [ ] Search/filter state is not persisted (resets on page reload)

---

## T08 — Verify Redaction Integration

**Description:** Verify that the Rust backend correctly calls `usePiiVaultStore().addEntry()` when GLiNER detects PII. Ensure redaction substitutes vault entries correctly. Test that `incrementUseCount()` is called after successful redaction.

**Files:** 
- apps/desktop/src-tauri/src/gliner.rs (verify GLiNER flow)
- apps/desktop/src-tauri/src/rehydration.rs (verify redaction substitution)

**Dependencies:** T01 (store methods must exist)

**SharedFiles:** 
- apps/desktop/src/stores/piiVault.ts (store)

**Effort:** M

**Acceptance:**
- [ ] GLiNER detection triggers `addEntry()` call with correct category
- [ ] Vault entry is created with unique ID, placeholder, and timestamp
- [ ] Redaction logic checks `hasEntry()` before substituting
- [ ] Redaction uses correct placeholder from vault entry
- [ ] After successful redaction, `incrementUseCount()` is called
- [ ] Vault count badge reflects use count increases
- [ ] No errors or panics in Rust during redaction

---

## T09 — End-to-End Manual Testing

**Description:** Perform comprehensive manual testing of all vault features. Create test cases for add/edit/delete/export flows, verify privacy messaging, and test on both desktop and mobile viewports.

**Files:** 
- Test checklist (reference only; no files to create)

**Dependencies:** T01-T07 (all components must be functional)

**SharedFiles:** None

**Effort:** M

**Acceptance:**
- [ ] Test 1: Create fresh app instance, verify empty vault state
- [ ] Test 2: Add custom redaction term, verify it appears in vault
- [ ] Test 3: Open vault modal, edit entry value, verify change saved
- [ ] Test 4: Delete entry, verify it's removed from list
- [ ] Test 5: Export vault, verify JSON file is downloaded and valid
- [ ] Test 6: Clear all with double-confirmation, verify all entries deleted
- [ ] Test 7: Verify privacy message is visible and accurate
- [ ] Test 8: Test search/filter with 10+ entries, verify results update
- [ ] Test 9: Send prompt with vault entry, verify redaction happens
- [ ] Test 10: Verify no regressions to existing Privacy Guard or Custom Redaction

---

## T10 — Regression & Unit Testing

**Description:** Run full test suite (Rust + React) to ensure no regressions. Write unit tests for store methods, component rendering, and integration points. Verify existing redaction logic still works.

**Files:** 
- apps/desktop/src/__tests__/stores/piiVault.test.ts (new, unit tests for store)
- apps/desktop/src/__tests__/components/VaultBrowser.test.tsx (new, component tests)
- apps/desktop/src-tauri/src/lib.rs (verify no test failures)

**Dependencies:** T01-T09 (all implementation done)

**SharedFiles:** None

**Effort:** M

**Acceptance:**
- [ ] All unit tests pass for `usePiiVaultStore` (add, remove, update, clear, export)
- [ ] All component tests pass (VaultBrowser, VaultList, VaultEntryModal rendering)
- [ ] Rust test suite passes: `cargo test` (from src-tauri)
- [ ] React test suite passes: `pnpm test`
- [ ] No console errors or warnings in dev build
- [ ] No localStorage corruption after vault operations
- [ ] Existing redaction tests still pass
- [ ] Privacy Guard (GLiNER) tests still pass
- [ ] Custom Redaction Terms tests still pass

---

## Task Execution Order (Recommended)

**Phase 1 — Foundation (Day 1)**
1. T01 — Update store methods (S, ~2 hours)

**Phase 2 — Components (Days 2-3)**
2. T02 — VaultBrowser parent (M, ~4 hours)
3. T03 — VaultList component (M, ~4 hours)
4. T04 — VaultEntryModal component (L, ~6 hours)
5. T05 — Export/Import (M, ~4 hours)
6. *(T02-T05 can run in parallel after T01)*

**Phase 3 — Integration (Day 4)**
7. T06 — Integrate into PrivacySettings (S, ~2 hours)
8. T07 — Search & filter logic (S, ~2 hours)
9. T08 — Verify redaction integration (M, ~3 hours)

**Phase 4 — Testing & QA (Day 5)**
10. T09 — End-to-end manual testing (M, ~4 hours)
11. T10 — Regression & unit testing (M, ~4 hours)

**Total: ~35 hours (~5 business days for one developer)**



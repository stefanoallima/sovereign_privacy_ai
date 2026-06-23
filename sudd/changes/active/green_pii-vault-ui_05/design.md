# PII Vault UI Design

**ID:** green_pii-vault-ui_05  
**Status:** Design Phase  
**Created:** 2026-06-23

---

## 1. Architecture Overview

The PII Vault UI integrates into the existing **Settings → Privacy & Local** tab as a new sub-section. Rather than creating a completely separate tab, we embed vault management into the Privacy panel hierarchy to keep all privacy controls in one logical place (as the proposal specifies).

**Layout:**
```
Settings Dialog
├── Sidebar Navigation (unchanged)
└── Content Area
    └── Privacy & Local tab (PrivacySettings.tsx)
        ├── Privacy Engine (existing)
        ├── Privacy Guard (existing)
        ├── Custom Redaction Terms (existing)
        ├── PII Vault Section (NEW)
        │   ├── Vault Header + Stats Badge
        │   ├── VaultBrowser Component
        │   │   ├── Search/Filter Bar
        │   │   ├── VaultList (table or card list)
        │   │   │   └── VaultEntry Items (with action buttons)
        │   │   └── Action Bar (Export, Clear All)
        │   └── VaultEntryModal (edit/view details)
        └── Default Privacy Mode (existing)
```

**Data Flow:**
```
React Component (VaultBrowser)
   ↓ (useCallback)
Zustand Store (usePiiVaultStore)
   ↓ (persist middleware)
localStorage "pii-vault"
```

All vault entries are persisted in the Zustand store with localStorage backup. No backend calls needed.

---

## 2. Component Structure

### Core Components

**2.1 VaultBrowser** (apps/desktop/src/components/settings/VaultBrowser.tsx)
- Parent container for the entire Vault UI
- Manages modal state (open/close VaultEntryModal)
- Handles search/filter state
- Renders the list and action buttons
- Accepts `onClose` callback if used as a modal
- Integrates into PrivacySettings.tsx as a section

**2.2 VaultList** (apps/desktop/src/components/settings/VaultList.tsx)
- Renders entries as a scrollable table or card grid
- Supports multiple view modes: table (default) or cards
- Responsive: table on desktop, cards on narrow
- Handles empty state messaging
- Shows type badges (auto-detected vs. manual)

**2.3 VaultEntryRow / VaultEntryCard** (in VaultList.tsx)
- Single entry row/card item
- Displays: Value (masked/unmasked on hover), Type, Count, Date Added
- Action buttons: View Details, Edit, Delete
- Hover effects and state indicators

**2.4 VaultEntryModal** (apps/desktop/src/components/settings/VaultEntryModal.tsx)
- Dialog showing full entry details
- Fields: Value, Type, Placeholder, Count, Date Added
- Tabs/Sections:
  - **Details Tab:** Read-only display of entry info
  - **Edit Tab:** Form to modify Value or Type
  - **Preview Tab:** Show how redaction works (e.g., "Acme Corp" → "[VAULT_COMPANY_1]")
- Actions: Save, Delete, Close
- Confirmation dialogs for destructive actions

**2.5 VaultStats Badge** (in VaultBrowser header)
- Shows entry count and storage size
- Visual indicator: entry count badge
- Optional: encryption status badge ("Encrypted with ChaCha20")

### Support Components

**2.6 SearchBar** (in VaultBrowser)
- Filter by value text or type category
- Real-time search as user types
- Quick-filter buttons for categories: (All, Names, Amounts, Medication, Custom)

**2.7 ExportDialog** (in VaultBrowser)
- Modal for export confirmation
- Shows: entry count, file size estimate
- Download button → triggers JSON export
- Security message: "Never shared with anyone"

**2.8 ConfirmClearAllDialog** (in VaultBrowser)
- Double-confirmation dialog for "Clear All"
- Shows: "This will remove all X entries. This cannot be undone."
- Cancel / Clear buttons

---

## 3. Data Flow

### Add Entry (Auto-Detect or Manual)
```
User enables Privacy Guard (GLiNER) or manually adds in Custom Redaction
  ↓
Rust backend detects PII (if GLiNER) or user types in Custom Redaction form
  ↓
Rust calls `usePiiVaultStore().addEntry(text, category)`
  ↓
Zustand updates entries[], persists to localStorage
  ↓
React component re-renders (VaultList shows new entry)
```

### Edit Entry
```
User clicks "Edit" button on VaultEntry
  ↓
VaultEntryModal opens with current value & type
  ↓
User modifies form fields and clicks "Save"
  ↓
Modal calls `usePiiVaultStore()` to update entry (replace old entry, keep ID)
  ↓
Zustand updates entries[], localStorage syncs
  ↓
VaultBrowser re-renders with updated list
```

### Delete Entry
```
User clicks "Delete" on VaultEntry or in Modal
  ↓
Confirmation dialog ("Are you sure?")
  ↓
User confirms
  ↓
Modal/List calls `usePiiVaultStore().removeEntry(id)`
  ↓
Zustand updates entries[], localStorage syncs
  ↓
Modal closes, VaultBrowser re-renders
```

### Export Vault
```
User clicks "Export" button
  ↓
ExportDialog shows confirmation + count
  ↓
User clicks "Export JSON"
  ↓
Frontend serializes entries[] to JSON (no encryption in export, plain-text backup)
  ↓
File picker → user saves to disk
  ↓
Toast notification: "Vault exported successfully"
```

### Import Vault (Future)
```
User selects "Import JSON" from File menu
  ↓
File picker → user selects JSON file
  ↓
Frontend parses JSON, merges entries (no duplicates)
  ↓
Zustand store updated, localStorage synced
  ↓
Toast + VaultBrowser re-renders
```

### Clear All
```
User clicks "Clear All" button
  ↓
ConfirmClearAllDialog shows double-confirmation
  ↓
User confirms twice
  ↓
Frontend calls `usePiiVaultStore().clear()`
  ↓
Zustand resets entries[] to [], localStorage cleared
  ↓
VaultBrowser shows empty state
```

---

## 4. Acceptance Criteria → Task Mapping

**AC1: Vault Browser UI is accessible**
- Task T01: Integrate VaultBrowser into PrivacySettings.tsx
- Task T02: Implement VaultList component with table layout
- ✓ Maps to: "Settings → Privacy → PII Vault section displays all entries"

**AC2: CRUD operations work**
- Task T03: Create VaultEntryModal for edit/view/delete
- Task T04: Wire edit button → modal → store update
- Task T05: Wire delete button → confirmation → store removal
- Task T06: Test CRUD flows end-to-end
- ✓ Maps to: "Create, Read, Update, Delete all work"

**AC3: Redaction uses vault**
- Task T07: Verify Rust backend calls `addEntry()` on GLiNER detection
- Task T08: Verify redaction substitution in prompts uses vault entries
- Task T09: Manual test with custom vault entry
- ✓ Maps to: "Add entry, send prompt, check redaction works"

**AC4: Export works**
- Task T05: Implement ExportDialog and JSON serialization
- Task T06: Test JSON round-trip (export → re-import)
- ✓ Maps to: "Export vault as JSON; reimport into same or different app instance"

**AC5: Privacy messaging is clear**
- Task T02: Add privacy badge + messaging in VaultBrowser header
- Task T03: Show "Stored on your machine, never transmitted" explainer
- Task T10: Add encryption status indicator
- ✓ Maps to: "User sees trust messaging and privacy clarity"

**AC6: No regressions**
- Task T11: Run full test suite (Rust + React)
- Task T12: Manual regression testing on redaction + Privacy Guard
- ✓ Maps to: "Existing redaction logic works; vault entries encrypted"

---

## 5. UI Specification

### 5.1 Vault Browser Section (in PrivacySettings.tsx)

**Header:**
```
┌────────────────────────────────────────────────┐
│ 🛡️ PII Vault                          [COUNT: 12] │
│ Saved personal data. Always redacted before cloud  │
│ Stored on your machine, encrypted locally          │
└────────────────────────────────────────────────┘
```

- **Title Icon:** Shield + Lock
- **Subtitle:** "Saved personal data. Always redacted before cloud sends."
- **Privacy message:** "Stored on your machine, encrypted locally. Never transmitted."
- **Badge:** Entry count (e.g., "12 ENTRIES") — color changes if empty (gray) → populated (green)

**Search & Filter:**
```
┌─────────────────────────────────────────────────┐
│ Search: [____________________] | All | Names | Amounts │
└─────────────────────────────────────────────────┘
```

**List Area (Table View):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Value          │ Type      │ Count │ Date Added      │ Actions   │
├─────────────────────────────────────────────────────────────────┤
│ Ac***          │ Company   │ 3     │ Jun 15, 2026    │ ... ⋮     │
│ Jo***          │ Person    │ 1     │ Jun 22, 2026    │ ... ⋮     │
│ 1234***        │ Amount    │ 5     │ Jun 20, 2026    │ ... ⋮     │
└─────────────────────────────────────────────────────────────────┘
```

- **Columns:** Value (masked by default, shown on hover), Type, Use Count, Date Added, Actions
- **Actions Menu (...):**
  - View Details
  - Edit
  - Delete

**Empty State:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              No PII vault entries yet.          │
│  When Privacy Guard detects data, it will      │
│              appear here. You can also add     │
│        custom entries in the Redaction section. │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Action Bar:**
```
[Export Vault] [Import Vault] [Clear All]
```

---

### 5.2 Vault Entry Modal

**View/Details Tab (default):**
```
┌──────────────────────────────────────────┐
│ Vault Entry: Acme Corp         [Edit][X] │
├──────────────────────────────────────────┤
│ Value:        Acme Corp                  │
│ Type:         Company Name               │
│ Placeholder:  [VAULT_COMPANY_1]          │
│ Use Count:    3                          │
│ Date Added:   June 15, 2026 10:23 AM    │
│ Status:       Auto-detected by Privacy   │
│               Guard                      │
├──────────────────────────────────────────┤
│ How it works:                            │
│ When you ask a question containing       │
│ "Acme Corp", it is replaced with        │
│ "[VAULT_COMPANY_1]" before sending to    │
│ the cloud. The original text stays on   │
│ your machine.                            │
├──────────────────────────────────────────┤
│                        [Close] [Delete]  │
└──────────────────────────────────────────┘
```

**Edit Tab:**
```
┌──────────────────────────────────────────┐
│ Edit Vault Entry                    [X]  │
├──────────────────────────────────────────┤
│ Value: [Acme Corp________]               │
│ Type:  [Company Name    ▼]               │
│        ├─ Company Name                   │
│        ├─ Person Name                    │
│        ├─ Email Address                  │
│        ├─ Phone Number                   │
│        ├─ Amount                         │
│        ├─ Medication                     │
│        └─ Custom                         │
│                                          │
│ Preview: [VAULT_COMPANY_1]               │
├──────────────────────────────────────────┤
│                       [Cancel] [Save]    │
└──────────────────────────────────────────┘
```

**Confirmation Dialogs:**

Delete Confirmation:
```
┌──────────────────────────────────────┐
│ Delete Entry?                    [X] │
├──────────────────────────────────────┤
│ You are about to remove "Acme Corp"  │
│ from your vault. It will no longer   │
│ be auto-redacted.                    │
│                                      │
│ This action cannot be undone.        │
├──────────────────────────────────────┤
│               [Cancel] [Delete]      │
└──────────────────────────────────────┘
```

Clear All Confirmation:
```
┌──────────────────────────────────────┐
│ Clear Entire Vault?              [X] │
├──────────────────────────────────────┤
│ You are about to remove all 12       │
│ entries from your vault. This will   │
│ break future redaction for these     │
│ values.                              │
│                                      │
│ This action cannot be undone.        │
│                                      │
│ ☐ I understand. Clear my vault.      │
├──────────────────────────────────────┤
│               [Cancel] [Clear All]   │
└──────────────────────────────────────┘
```

---

### 5.3 Export Dialog

```
┌────────────────────────────────────────────────┐
│ Export PII Vault                          [X]  │
├────────────────────────────────────────────────┤
│ You are about to download your vault as JSON.  │
│                                                │
│ Entries: 12                                    │
│ Estimated Size: ~4 KB                          │
│                                                │
│ 🔒 This file will be saved to your Downloads  │
│ folder. It is never sent anywhere.             │
│                                                │
│ ⚠️  Keep it safe: Do not share this file with  │
│ anyone else.                                   │
├────────────────────────────────────────────────┤
│                         [Cancel] [Export JSON] │
└────────────────────────────────────────────────┘
```

---

## 6. API & Integration Points

### 6.1 Zustand Store Updates

Current `usePiiVaultStore` interface (add these methods):
```typescript
interface PiiVaultStore {
  entries: PiiVaultEntry[];
  addEntry: (text: string, category: string) => PiiVaultEntry;
  removeEntry: (id: string) => void;
  incrementUseCount: (id: string) => void;
  hasEntry: (text: string) => boolean;
  clear: () => void;
  updateEntry: (id: string, text: string, category: string) => void;  // NEW
  exportEntries: () => PiiVaultEntry[];  // NEW
}
```

### 6.2 Redaction Integration

**Rust backend (src-tauri/src/rehydration.rs):**
- When redacting a prompt, check `usePiiVaultStore().hasEntry(value)`
- If found, substitute with the placeholder from vault entry
- Call `incrementUseCount(id)` after successful redaction
- (No changes needed; reuse existing redaction logic)

**React component (VaultBrowser):**
- Display vault entries that are actively being used (useCount > 0) with a badge
- Show "active redaction" indicator for frequently-used entries

### 6.3 File Export/Import

**Export:**
```typescript
// In VaultBrowser.tsx
const handleExport = async () => {
  const entries = usePiiVaultStore.getState().exportEntries();
  const json = JSON.stringify(entries, null, 2);
  
  // Use @tauri-apps/plugin-dialog and @tauri-apps/plugin-fs
  // to save file to Downloads folder
  
  // Toast: "Vault exported to ~/Downloads/pii-vault-YYYY-MM-DD.json"
}
```

**Import (Future, Post-v1):**
```typescript
const handleImport = async () => {
  // File picker → select JSON file
  // Parse JSON → validate structure
  // usePiiVaultStore.getState().importEntries(parsed)
  // Toast: "X entries imported"
}
```

### 6.4 Encryption at Rest

- **No changes needed:** Zustand `persist` middleware already handles localStorage
- **Vault entries stored as:** `localStorage['pii-vault']` (JSON string)
- **Optional:** Add a setting to encrypt localStorage with ChaCha20 (existing `encryptLocalData` toggle)
- **For display:** Always show badge "Encrypted with ChaCha20" if `settings.encryptLocalData === true`

---

## 7. Risks & Constraints

### 7.1 Browser/Desktop Considerations

- **localStorage limits:** If vault grows to 1000+ entries with long values, localStorage may hit 5–10 MB limit (Firefox) or 10 MB (Chrome). Mitigate: add a warning at 500 entries, suggest export.
- **Electron/Tauri:** File picker integration requires `@tauri-apps/plugin-dialog` and file write APIs. Available since Tauri v2.
- **Cross-platform:** Export/import paths differ (Windows: `C:\Users\...\Downloads`, macOS: `~/Downloads`, Linux: `~/Downloads`). Use Tauri's `path` APIs to normalize.

### 7.2 UI/UX Edge Cases

- **Very long values:** Truncate in list view (e.g., "Acme Corp's Long..." → truncate at 30 chars)
- **Duplicate values with different types:** Allow (e.g., "Smith" as both "Person Name" and "Company Name")
- **Search performance:** With 1000+ entries, search should be debounced (300ms) to avoid lag
- **Modal state management:** If user is editing and clicks browser back, modal should close gracefully

### 7.3 Privacy & Security

- **Export is plain-text:** JSON file contains unencrypted PII values. Add warning in export dialog.
- **localStorage is not encrypted by default** in browser. If user doesn't enable `encryptLocalData`, vault is stored plaintext. Document this clearly.
- **Tauri provides better isolation** than browser; use `@tauri-apps/plugin-fs` with file permissions for added security.

### 7.4 Redaction Integration

- **Race condition:** If user deletes an entry while a prompt is being redacted, the deletion should be instant (store update) but the in-flight redaction uses stale reference. Mitigate: incrementUseCount is idempotent, deletion is final.
- **Placeholder collisions:** If two entries have the same category, they get `[VAULT_COMPANY_1]`, `[VAULT_COMPANY_2]`. Ensure counter resets on app restart (handled by store initialization).

### 7.5 Performance

- **VaultList rendering:** With 500+ entries, virtualization may be needed (use `react-window` or similar). Start with simple list; profile if slow.
- **Search debouncing:** Real-time search in large lists should debounce to avoid re-renders on every keystroke.
- **Export serialization:** Large vaults (1000+ entries) may take 1–2 seconds to serialize. Add progress indicator if needed.

---

## 8. Testing Strategy

**Unit Tests:**
- `usePiiVaultStore` store methods (add, remove, update, clear, export)
- VaultBrowser component (search, filter, modal open/close)
- VaultEntryModal validation (form submission, confirmation dialogs)

**Integration Tests:**
- VaultBrowser ↔ PrivacySettings integration
- Store persistence to localStorage
- Export/import round-trip JSON serialization

**Manual Tests:**
- Test 1: View & navigate vault entries
- Test 2: Add entry via Custom Redaction, verify vault shows it
- Test 3: Edit entry value and type, verify redaction updates
- Test 4: Delete entry, verify it no longer redacts
- Test 5: Export vault as JSON, verify file format and content
- Test 6: Clear all entries with double-confirmation
- Test 7: Verify privacy messaging is clear and accurate
- Test 8: Regression test existing redaction logic, Privacy Guard, Custom Redaction Terms

---

## 9. Future Enhancements (Post-v1)

1. **Vault Categories:** Group entries by project or client
2. **Auto-Add Suggestions:** "We found 'Acme Corp' in your chats; add to vault?"
3. **Vault Sharing:** Export encrypted vault bundle for team collaboration
4. **Domain-Specific Rules:** Per-persona custom redaction rules (e.g., Tax Advisor auto-detects tax IDs)
5. **Analytics:** Show which entries are most redacted (privacy heatmap)
6. **Backup & Sync:** Auto-backup vault to cloud (encrypted) for device sync

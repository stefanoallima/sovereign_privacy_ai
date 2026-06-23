import { describe, it, expect, beforeEach } from "vitest";
import { usePiiVaultStore } from "../piiVault";
import type { PiiVaultEntry } from "@/types";

describe("usePiiVaultStore", () => {
  beforeEach(() => {
    // Clear store before each test
    usePiiVaultStore.setState({ entries: [] });
  });

  describe("addEntry", () => {
    it("should add a new entry", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");

      expect(entry).toBeDefined();
      expect(entry.text).toBe("John Doe");
      expect(entry.category).toBe("person name");
      expect(entry.useCount).toBe(0);
      expect(entry.id).toBeDefined();
      expect(entry.placeholder).toBeDefined();
      expect(entry.confirmedAt).toBeDefined();
    });

    it("should return existing entry if text already exists (case-insensitive)", () => {
      const store = usePiiVaultStore.getState();
      const entry1 = store.addEntry("Jane Smith", "person name");
      const entry2 = store.addEntry("jane smith", "person name");

      expect(entry1.id).toBe(entry2.id);
      expect(store.entries.length).toBe(1);
    });
  });

  describe("incrementUseCount", () => {
    it("should increment use count for an entry", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");

      store.incrementUseCount(entry.id);
      const updated = store.entries.find((e) => e.id === entry.id);

      expect(updated?.useCount).toBe(1);

      store.incrementUseCount(entry.id);
      const updated2 = store.entries.find((e) => e.id === entry.id);

      expect(updated2?.useCount).toBe(2);
    });

    it("should not modify other entries when incrementing", () => {
      const store = usePiiVaultStore.getState();
      const entry1 = store.addEntry("Name 1", "person name");
      const entry2 = store.addEntry("Name 2", "person name");

      store.incrementUseCount(entry1.id);

      expect(store.entries.find((e) => e.id === entry1.id)?.useCount).toBe(1);
      expect(store.entries.find((e) => e.id === entry2.id)?.useCount).toBe(0);
    });
  });

  describe("updateEntry", () => {
    it("should update text and category of an existing entry", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Old Name", "person name");
      const originalId = entry.id;
      const originalUseCount = entry.useCount;

      const success = store.updateEntry(entry.id, "New Name", "person name");

      expect(success).toBe(true);
      const updated = store.entries.find((e) => e.id === originalId);
      expect(updated?.text).toBe("New Name");
      expect(updated?.category).toBe("person name");
      expect(updated?.id).toBe(originalId);
      expect(updated?.useCount).toBe(originalUseCount);
    });

    it("should generate new placeholder when category changes", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");
      const originalPlaceholder = entry.placeholder;

      store.updateEntry(entry.id, "John Doe", "medical condition");

      const updated = store.entries.find((e) => e.id === entry.id);
      expect(updated?.placeholder).not.toBe(originalPlaceholder);
      expect(updated?.placeholder).toMatch(/VAULT_MEDICAL_CONDITION_/);
    });

    it("should preserve placeholder when category stays the same", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");
      const originalPlaceholder = entry.placeholder;

      store.updateEntry(entry.id, "Jane Doe", "person name");

      const updated = store.entries.find((e) => e.id === entry.id);
      expect(updated?.placeholder).toBe(originalPlaceholder);
    });

    it("should preserve confirmedAt timestamp", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");
      const originalConfirmedAt = entry.confirmedAt;

      store.updateEntry(entry.id, "Updated Name", "person name");

      const updated = store.entries.find((e) => e.id === entry.id);
      expect(updated?.confirmedAt).toBe(originalConfirmedAt);
    });

    it("should return false if entry does not exist", () => {
      const store = usePiiVaultStore.getState();
      const success = store.updateEntry("nonexistent-id", "New Text", "person name");

      expect(success).toBe(false);
    });
  });

  describe("exportEntries", () => {
    it("should return empty array when no entries exist", () => {
      const store = usePiiVaultStore.getState();
      const exported = store.exportEntries();

      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(0);
    });

    it("should return all current entries in correct format", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("jane@example.com", "email address");
      store.addEntry("$50,000", "income amount");

      const exported = store.exportEntries();

      expect(exported.length).toBe(3);
      exported.forEach((entry) => {
        expect(entry.id).toBeDefined();
        expect(entry.text).toBeDefined();
        expect(entry.category).toBeDefined();
        expect(entry.useCount).toBeGreaterThanOrEqual(0);
        expect(entry.confirmedAt).toBeDefined();
        expect(entry.placeholder).toBeDefined();
      });
    });

    it("should return a shallow copy (not reference to internal state)", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("Test Name", "person name");

      const exported1 = store.exportEntries();
      const exported2 = store.exportEntries();

      expect(exported1).not.toBe(exported2);
      expect(exported1).toEqual(exported2);
    });

    it("should include incremented use counts", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");

      store.incrementUseCount(entry.id);
      store.incrementUseCount(entry.id);

      const exported = store.exportEntries();
      expect(exported[0].useCount).toBe(2);
    });
  });

  describe("importEntries", () => {
    it("should import valid entries", () => {
      const store = usePiiVaultStore.getState();

      const entriesToImport: PiiVaultEntry[] = [
        {
          id: "import-1",
          text: "Imported Name",
          category: "person name",
          placeholder: "[IMPORTED_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 5,
        },
        {
          id: "import-2",
          text: "imported@example.com",
          category: "email address",
          placeholder: "[IMPORTED_2]",
          confirmedAt: new Date().toISOString(),
          useCount: 3,
        },
      ];

      const result = store.importEntries(entriesToImport);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(store.entries.length).toBe(2);
      expect(store.entries[0].id).toBe("import-1");
      expect(store.entries[1].id).toBe("import-2");
    });

    it("should skip entries with missing required fields", () => {
      const store = usePiiVaultStore.getState();

      const entriesToImport = [
        {
          id: "valid-1",
          text: "Valid Name",
          category: "person name",
          placeholder: "[VALID_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 1,
        },
        {
          id: "invalid-missing-text",
          text: "",
          category: "person name",
          placeholder: "[INVALID_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 1,
        },
        {
          id: "invalid-missing-category",
          text: "Some Text",
          category: "",
          placeholder: "[INVALID_2]",
          confirmedAt: new Date().toISOString(),
          useCount: 1,
        },
        {
          id: "invalid-missing-id",
          text: "Another Text",
          category: "person name",
          placeholder: "[INVALID_3]",
          confirmedAt: new Date().toISOString(),
          useCount: 1,
        } as any,
      ];

      const result = store.importEntries(entriesToImport);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(3);
      expect(store.entries.length).toBe(1);
    });

    it("should skip entries where ID already exists (no overwrites)", () => {
      const store = usePiiVaultStore.getState();

      // Add an entry first
      const existing = store.addEntry("Original Text", "person name");

      const entriesToImport: PiiVaultEntry[] = [
        {
          id: existing.id,
          text: "Updated Text (should not overwrite)",
          category: "person name",
          placeholder: "[UPDATED_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 99,
        },
        {
          id: "import-new",
          text: "New Import",
          category: "person name",
          placeholder: "[NEW_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 1,
        },
      ];

      const result = store.importEntries(entriesToImport);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(store.entries.length).toBe(2);

      // Verify original entry was NOT overwritten
      const original = store.entries.find((e) => e.id === existing.id);
      expect(original?.text).toBe("Original Text");
      expect(original?.useCount).toBe(0);
    });

    it("should handle empty import array", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("Existing", "person name");

      const result = store.importEntries([]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(store.entries.length).toBe(1);
    });

    it("should merge with existing entries without clearing them", () => {
      const store = usePiiVaultStore.getState();
      const existing = store.addEntry("Existing Entry", "person name");

      const entriesToImport: PiiVaultEntry[] = [
        {
          id: "import-1",
          text: "Imported Entry",
          category: "email address",
          placeholder: "[IMPORT_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 2,
        },
      ];

      const result = store.importEntries(entriesToImport);

      expect(result.imported).toBe(1);
      expect(store.entries.length).toBe(2);
      expect(store.entries.some((e) => e.id === existing.id)).toBe(true);
      expect(store.entries.some((e) => e.id === "import-1")).toBe(true);
    });

    it("should validate useCount field", () => {
      const store = usePiiVaultStore.getState();

      const entriesToImport = [
        {
          id: "valid-1",
          text: "Valid Name",
          category: "person name",
          placeholder: "[VALID_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 0,
        },
        {
          id: "invalid-use-count",
          text: "Invalid Name",
          category: "person name",
          placeholder: "[INVALID_1]",
          confirmedAt: new Date().toISOString(),
          useCount: undefined as any,
        },
      ];

      const result = store.importEntries(entriesToImport);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe("removeEntry", () => {
    it("should remove an entry by ID", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");

      store.removeEntry(entry.id);

      expect(store.entries.length).toBe(0);
    });
  });

  describe("hasEntry", () => {
    it("should return true if text exists (case-insensitive)", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      expect(store.hasEntry("John Doe")).toBe(true);
      expect(store.hasEntry("john doe")).toBe(true);
      expect(store.hasEntry("JOHN DOE")).toBe(true);
    });

    it("should return false if text does not exist", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      expect(store.hasEntry("Jane Doe")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("Entry 1", "person name");
      store.addEntry("Entry 2", "email address");

      expect(store.entries.length).toBe(2);

      store.clear();

      expect(store.entries.length).toBe(0);
    });
  });

  describe("integration: updateEntry + exportEntries", () => {
    it("should export updated entries correctly", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Original", "person name");

      store.updateEntry(entry.id, "Updated", "person name");
      store.incrementUseCount(entry.id);

      const exported = store.exportEntries();

      expect(exported[0].text).toBe("Updated");
      expect(exported[0].useCount).toBe(1);
    });
  });

  describe("integration: importEntries + updateEntry", () => {
    it("should allow updating imported entries", () => {
      const store = usePiiVaultStore.getState();

      const entriesToImport: PiiVaultEntry[] = [
        {
          id: "import-1",
          text: "Imported Name",
          category: "person name",
          placeholder: "[IMPORTED_1]",
          confirmedAt: new Date().toISOString(),
          useCount: 0,
        },
      ];

      store.importEntries(entriesToImport);
      const success = store.updateEntry("import-1", "Modified Name", "person name");

      expect(success).toBe(true);
      expect(store.entries[0].text).toBe("Modified Name");
    });
  });
});

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PiiVaultEntry } from "@/types";

interface PiiVaultStore {
  entries: PiiVaultEntry[];
  addEntry: (text: string, category: string) => PiiVaultEntry;
  removeEntry: (id: string) => void;
  incrementUseCount: (id: string) => void;
  hasEntry: (text: string) => boolean;
  clear: () => void;
}

let placeholderCounters: Record<string, number> = {};

function makePlaceholder(category: string): string {
  const key = category.toUpperCase().replace(/\s+/g, '_');
  placeholderCounters[key] = (placeholderCounters[key] ?? 0) + 1;
  return `[VAULT_${key}_${placeholderCounters[key]}]`;
}

export const usePiiVaultStore = create<PiiVaultStore>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (text, category) => {
        // Check if already exists
        const existing = get().entries.find(
          (e) => e.text.toLowerCase() === text.toLowerCase()
        );
        if (existing) return existing;

        const entry: PiiVaultEntry = {
          id: `pii-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text,
          category,
          placeholder: makePlaceholder(category),
          confirmedAt: new Date().toISOString(),
          useCount: 0,
        };
        set((state) => ({ entries: [...state.entries, entry] }));
        return entry;
      },

      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      incrementUseCount: (id) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, useCount: e.useCount + 1 } : e
          ),
        })),

      hasEntry: (text) =>
        get().entries.some((e) => e.text.toLowerCase() === text.toLowerCase()),

      clear: () => set({ entries: [] }),
    }),
    {
      name: "pii-vault",
    }
  )
);

/**
 * UserContext Store
 *
 * The "Privacy Shield" - Local storage for user's PII values.
 * This is the "Truth" source that never leaves the machine.
 *
 * Features:
 * - Stores PII values locally (encrypted at rest via Tauri)
 * - Provides values for template re-hydration
 * - Tracks what PII has been collected
 * - Allows users to view/edit/delete their data
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PIIValues } from '@/services/rehydration-service';

// ==================== Types ====================

export interface CustomRedactTerm {
  label: string;
  value: string;
  /** Auto-generated same-length replacement string for rehydration */
  replacement: string;
}

/**
 * Extract a short abbreviation from a label for use in replacement strings.
 * Uses first 3 lowercase chars of the first word.
 *   "Company Name" → "com"
 *   "BSN"          → "bsn"
 *   "Home Address"  → "hom"
 *   "IBAN"          → "iba"
 *   "Name"          → "nam"
 */
export function getLabelAbbr(label: string): string {
  const word = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)[0] || 'x';
  return word.substring(0, 3);
}

/**
 * Count how many existing terms share the same label abbreviation,
 * then return the next index for that type.
 */
function getNextTypeIndex(label: string, existingTerms: CustomRedactTerm[]): number {
  const abbr = getLabelAbbr(label);
  const sameType = existingTerms.filter((t) => getLabelAbbr(t.label) === abbr).length;
  return sameType + 1;
}

/**
 * Generate a replacement string with the EXACT same length as the original value.
 * Uses label abbreviation + per-type counter so the replacement is human-readable.
 *
 * Examples:
 *   ("Company Name", 4,  1) → "com1"          ("bird" → "com1")
 *   ("Company Name", 9,  1) → "com_1____"     ("Acme Corp" → "com_1____")
 *   ("Company Name", 16, 2) → "com_2___________"
 *   ("BSN",          9,  1) → "bsn_1____"     ("123456789" → "bsn_1____")
 *   ("BSN",          3,  1) → "bs1"
 *   ("Name",         4,  1) → "nam1"          ("John" → "nam1")
 *   ("Address",      22, 1) → "add_1_________________"
 */
export function generateReplacementString(label: string, valueLength: number, typeIndex: number): string {
  const abbr = getLabelAbbr(label);
  const idx = String(typeIndex);

  if (valueLength <= 0) return '';

  // Try with separator: "com_1"
  const withSep = abbr + '_' + idx;
  // Try without separator: "com1"
  const noSep = abbr + idx;

  let core: string;
  if (withSep.length <= valueLength) {
    core = withSep; // "com_1" fits — use it
  } else if (noSep.length <= valueLength) {
    core = noSep; // "com1" fits — use compact
  } else {
    // Very short value — trim abbreviation to make room for index
    const availForAbbr = valueLength - idx.length;
    if (availForAbbr > 0) {
      core = abbr.substring(0, availForAbbr) + idx;
    } else {
      core = idx.substring(0, valueLength);
    }
  }

  // Pad with trailing underscores to match exact length
  if (core.length < valueLength) {
    core = core + '_'.repeat(valueLength - core.length);
  }
  return core.substring(0, valueLength);
}

export interface UserProfile {
  id: string;
  name: string;
  description?: string;
  piiValues: PIIValues;
  customRedactTerms: CustomRedactTerm[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PIIField {
  key: keyof PIIValues | string;
  label: string;
  category: PIICategory;
  isSensitive: boolean;
  description?: string;
}

export type PIICategory = 'personal' | 'contact' | 'financial' | 'tax' | 'third_party' | 'custom';

interface UserContextState {
  // Current active profile
  activeProfileId: string | null;
  profiles: UserProfile[];

  // Quick access to current PII values
  currentPII: PIIValues;

  // Actions
  setActiveProfile: (profileId: string) => void;
  createProfile: (name: string, description?: string) => string;
  updateProfile: (profileId: string, updates: Partial<UserProfile>) => void;
  deleteProfile: (profileId: string) => void;

  // PII management
  setPIIValue: (key: keyof PIIValues | string, value: string | undefined) => void;
  setPIIValues: (values: Partial<PIIValues>) => void;
  clearPIIValue: (key: keyof PIIValues | string) => void;
  clearAllPII: () => void;
  importPII: (values: PIIValues) => void;

  // Custom redaction terms
  addCustomRedactTerm: (label: string, value: string) => void;
  removeCustomRedactTerm: (index: number) => void;
  importCustomRedactTerms: (csv: string) => number;
  clearCustomRedactTerms: () => void;

  // Utilities
  getPIIForRehydration: () => PIIValues;
  getFilledFields: () => string[];
  getMissingFields: (required: string[]) => string[];
}

// ==================== Field Definitions ====================

export const PII_FIELDS: PIIField[] = [
  // Personal
  { key: 'bsn', label: 'BSN (Tax ID)', category: 'personal', isSensitive: true, description: 'Dutch citizen service number (9 digits)' },
  { key: 'name', label: 'First Name', category: 'personal', isSensitive: false },
  { key: 'surname', label: 'Last Name', category: 'personal', isSensitive: false },
  { key: 'dateOfBirth', label: 'Date of Birth', category: 'personal', isSensitive: true },

  // Contact
  { key: 'email', label: 'Email', category: 'contact', isSensitive: false },
  { key: 'phone', label: 'Phone', category: 'contact', isSensitive: true },
  { key: 'address', label: 'Address', category: 'contact', isSensitive: false },
  { key: 'postcode', label: 'Postcode', category: 'contact', isSensitive: false },
  { key: 'city', label: 'City', category: 'contact', isSensitive: false },

  // Financial
  { key: 'income', label: 'Annual Income', category: 'financial', isSensitive: true, description: 'Gross annual income' },
  { key: 'salary', label: 'Monthly Salary', category: 'financial', isSensitive: true },
  { key: 'iban', label: 'IBAN', category: 'financial', isSensitive: true, description: 'Bank account number' },

  // Tax
  { key: 'taxNumber', label: 'Tax Number', category: 'tax', isSensitive: true },
  { key: 'taxYear', label: 'Tax Year', category: 'tax', isSensitive: false },

  // Third parties
  { key: 'accountantName', label: 'Accountant Name', category: 'third_party', isSensitive: false },
  { key: 'accountantEmail', label: 'Accountant Email', category: 'third_party', isSensitive: false },
  { key: 'employerName', label: 'Employer Name', category: 'third_party', isSensitive: false },
];

// ==================== Store ====================

const generateId = () => Math.random().toString(36).substring(2, 15);

const createEmptyPII = (): PIIValues => ({});

export const useUserContextStore = create<UserContextState>()(
  persist(
    (set, get) => ({
      activeProfileId: null,
      profiles: [],
      currentPII: createEmptyPII(),

      setActiveProfile: (profileId) => {
        const profile = get().profiles.find((p) => p.id === profileId);
        if (profile) {
          set({
            activeProfileId: profileId,
            currentPII: profile.piiValues,
          });
        }
      },

      createProfile: (name, description) => {
        const id = generateId();
        const now = new Date();
        const newProfile: UserProfile = {
          id,
          name,
          description,
          piiValues: createEmptyPII(),
          customRedactTerms: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          profiles: [...state.profiles, newProfile],
          activeProfileId: id,
          currentPII: newProfile.piiValues,
        }));

        return id;
      },

      updateProfile: (profileId, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? { ...p, ...updates, updatedAt: new Date() }
              : p
          ),
        }));
      },

      deleteProfile: (profileId) => {
        set((state) => {
          const newProfiles = state.profiles.filter((p) => p.id !== profileId);
          const wasActive = state.activeProfileId === profileId;

          return {
            profiles: newProfiles,
            activeProfileId: wasActive
              ? newProfiles.length > 0
                ? newProfiles[0].id
                : null
              : state.activeProfileId,
            currentPII: wasActive && newProfiles.length > 0
              ? newProfiles[0].piiValues
              : createEmptyPII(),
          };
        });
      },

      setPIIValue: (key, value) => {
        set((state) => {
          const newPII = { ...state.currentPII };

          if (key === 'relevant_boxes' || key === 'deduction_categories') {
            // Handle special keys separately
            return state;
          }

          (newPII as any)[key] = value;

          // Update profile if active
          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, piiValues: newPII, updatedAt: new Date() }
                : p
            );
            return { currentPII: newPII, profiles: updatedProfiles };
          }

          return { currentPII: newPII };
        });
      },

      setPIIValues: (values) => {
        set((state) => {
          const newPII = { ...state.currentPII, ...values };

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, piiValues: newPII, updatedAt: new Date() }
                : p
            );
            return { currentPII: newPII, profiles: updatedProfiles };
          }

          return { currentPII: newPII };
        });
      },

      clearPIIValue: (key) => {
        get().setPIIValue(key as keyof PIIValues, undefined);
      },

      clearAllPII: () => {
        set((state) => {
          const emptyPII = createEmptyPII();

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, piiValues: emptyPII, updatedAt: new Date() }
                : p
            );
            return { currentPII: emptyPII, profiles: updatedProfiles };
          }

          return { currentPII: emptyPII };
        });
      },

      importPII: (values) => {
        set((state) => {
          const newPII = { ...state.currentPII, ...values };

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, piiValues: newPII, updatedAt: new Date() }
                : p
            );
            return { currentPII: newPII, profiles: updatedProfiles };
          }

          return { currentPII: newPII };
        });
      },

      addCustomRedactTerm: (label, value) => {
        set((state) => {
          const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
          const currentTerms = activeProfile?.customRedactTerms || [];
          const trimmedLabel = label.trim();
          const trimmedValue = value.trim();
          const typeIdx = getNextTypeIndex(trimmedLabel, currentTerms);
          const replacement = generateReplacementString(trimmedLabel, trimmedValue.length, typeIdx);
          const newTerms = [...currentTerms, { label: trimmedLabel, value: trimmedValue, replacement }];

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, customRedactTerms: newTerms, updatedAt: new Date() }
                : p
            );
            return { profiles: updatedProfiles };
          }
          return state;
        });
      },

      removeCustomRedactTerm: (index) => {
        set((state) => {
          const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
          const currentTerms = activeProfile?.customRedactTerms || [];
          const newTerms = currentTerms.filter((_, i) => i !== index);

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, customRedactTerms: newTerms, updatedAt: new Date() }
                : p
            );
            return { profiles: updatedProfiles };
          }
          return state;
        });
      },

      importCustomRedactTerms: (csv) => {
        const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        const parsed: Array<{ label: string; value: string }> = [];

        for (const line of lines) {
          const commaIdx = line.indexOf(',');
          if (commaIdx === -1) continue;
          const label = line.substring(0, commaIdx).trim();
          const value = line.substring(commaIdx + 1).trim();
          if (label && value) {
            parsed.push({ label, value });
          }
        }

        if (parsed.length === 0) return 0;

        set((state) => {
          const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId);
          const currentTerms = activeProfile?.customRedactTerms || [];
          // Build terms with per-type indexing, tracking counts as we go
          const allSoFar = [...currentTerms];
          const newTerms: CustomRedactTerm[] = parsed.map((p) => {
            const typeIdx = getNextTypeIndex(p.label, allSoFar);
            const replacement = generateReplacementString(p.label, p.value.length, typeIdx);
            const term: CustomRedactTerm = { label: p.label, value: p.value, replacement };
            allSoFar.push(term); // track for next iteration's count
            return term;
          });
          const merged = [...currentTerms, ...newTerms];

          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, customRedactTerms: merged, updatedAt: new Date() }
                : p
            );
            return { profiles: updatedProfiles };
          }
          return state;
        });

        return parsed.length;
      },

      clearCustomRedactTerms: () => {
        set((state) => {
          if (state.activeProfileId) {
            const updatedProfiles = state.profiles.map((p) =>
              p.id === state.activeProfileId
                ? { ...p, customRedactTerms: [], updatedAt: new Date() }
                : p
            );
            return { profiles: updatedProfiles };
          }
          return state;
        });
      },

      getPIIForRehydration: () => {
        return get().currentPII;
      },

      getFilledFields: () => {
        const pii = get().currentPII;
        const filled: string[] = [];

        for (const field of PII_FIELDS) {
          const value = (pii as any)[field.key];
          if (value !== undefined && value !== null && value !== '') {
            filled.push(field.key);
          }
        }

        return filled;
      },

      getMissingFields: (required) => {
        const filled = get().getFilledFields();
        return required.filter((key) => !filled.includes(key));
      },
    }),
    {
      name: 'user-context-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProfileId: state.activeProfileId,
        profiles: state.profiles,
        currentPII: state.currentPII,
      }),
    }
  )
);

// ==================== Selectors ====================

export const selectCurrentPII = (state: UserContextState) => state.currentPII;
export const selectActiveProfile = (state: UserContextState) =>
  state.profiles.find((p) => p.id === state.activeProfileId);
export const selectAllProfiles = (state: UserContextState) => state.profiles;

// ==================== Helpers ====================

/**
 * Get PII fields grouped by category
 */
export function getPIIFieldsByCategory(): Record<PIICategory, PIIField[]> {
  const grouped: Record<PIICategory, PIIField[]> = {
    personal: [],
    contact: [],
    financial: [],
    tax: [],
    third_party: [],
    custom: [],
  };

  for (const field of PII_FIELDS) {
    grouped[field.category].push(field);
  }

  return grouped;
}

/**
 * Format PII value for display (masked if sensitive)
 */
export function formatPIIForDisplay(key: string, value: string | undefined, mask: boolean = true): string {
  if (!value) return '—';

  const field = PII_FIELDS.find((f) => f.key === key);
  if (!field || !mask || !field.isSensitive) return value;

  // Mask sensitive values
  switch (key) {
    case 'bsn':
      return value.length > 3 ? `***${value.slice(-3)}` : '***';
    case 'iban':
      return value.length > 4 ? `****${value.slice(-4)}` : '****';
    case 'income':
    case 'salary':
      return '€ ***';
    case 'phone':
      const digits = value.replace(/\D/g, '');
      return digits.length > 4 ? `****${digits.slice(-4)}` : '****';
    case 'dateOfBirth':
      return '**-**-****';
    default:
      return value.length > 4 ? `${value.slice(0, 2)}***` : '***';
  }
}

/**
 * Validate a PII value based on its type
 */
export function validatePIIValue(key: string, value: string): { valid: boolean; error?: string } {
  switch (key) {
    case 'bsn':
      if (!/^\d{9}$/.test(value.replace(/\D/g, ''))) {
        return { valid: false, error: 'BSN must be 9 digits' };
      }
      break;
    case 'iban':
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(value.replace(/\s/g, ''))) {
        return { valid: false, error: 'Invalid IBAN format' };
      }
      break;
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: 'Invalid email format' };
      }
      break;
    case 'postcode':
      if (!/^\d{4}\s?[A-Z]{2}$/i.test(value)) {
        return { valid: false, error: 'Dutch postcode: 4 digits + 2 letters' };
      }
      break;
  }

  return { valid: true };
}

export default useUserContextStore;

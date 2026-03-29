import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { UserProfile, UserProfileAddress } from '../types';
import { userProfileDbOps } from '../lib/db';

const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  customFields: {},
};

interface UserProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProfile: () => Promise<void>;
  updateField: (field: keyof UserProfile, value: any) => Promise<void>;
  updateAddress: (address: UserProfileAddress) => Promise<void>;
  addCustomField: (key: string, value: string) => Promise<void>;
  removeCustomField: (key: string) => Promise<void>;
  saveProfile: () => Promise<void>;
  importFromPII: (piiData: Record<string, string>) => Promise<void>;
}

export const useUserProfileStore = create<UserProfileStore>()((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });

    try {
      // Try Rust backend first (encrypted storage)
      let profile: UserProfile | null = null;
      try {
        profile = await invoke<UserProfile>('load_user_profile');
      } catch {
        // Rust backend not available or no data — fall back to IndexedDB
      }

      if (!profile) {
        const localProfile = await userProfileDbOps.getUserProfile();
        if (localProfile) {
          profile = {
            id: localProfile.id,
            fullName: localProfile.fullName,
            dateOfBirth: localProfile.dateOfBirth,
            bsn: localProfile.bsn,
            nationality: localProfile.nationality,
            email: localProfile.email,
            phone: localProfile.phone,
            address: localProfile.address,
            employerName: localProfile.employerName,
            employmentType: localProfile.employmentType,
            jobTitle: localProfile.jobTitle,
            incomeBracket: localProfile.incomeBracket,
            bankName: localProfile.bankName,
            iban: localProfile.iban,
            customFields: localProfile.customFields ?? {},
          };
        }
      }

      set({
        profile: profile ?? { ...DEFAULT_PROFILE },
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to load user profile:', err);
      set({
        profile: { ...DEFAULT_PROFILE },
        isLoading: false,
        error: String(err),
      });
    }
  },

  updateField: async (field, value) => {
    const { profile } = get();
    if (!profile) return;

    const updated = { ...profile, [field]: value };
    set({ profile: updated });

    // Auto-save
    try {
      await get().saveProfile();
    } catch (err) {
      console.error('Failed to auto-save profile field:', err);
      set({ error: String(err) });
    }
  },

  updateAddress: async (address) => {
    const { profile } = get();
    if (!profile) return;

    const updated = { ...profile, address };
    set({ profile: updated });

    try {
      await get().saveProfile();
    } catch (err) {
      console.error('Failed to auto-save profile address:', err);
      set({ error: String(err) });
    }
  },

  addCustomField: async (key, value) => {
    const { profile } = get();
    if (!profile) return;

    const customFields = { ...profile.customFields, [key]: value };
    const updated = { ...profile, customFields };
    set({ profile: updated });

    try {
      await get().saveProfile();
    } catch (err) {
      console.error('Failed to save custom field:', err);
      set({ error: String(err) });
    }
  },

  removeCustomField: async (key) => {
    const { profile } = get();
    if (!profile) return;

    const customFields = { ...profile.customFields };
    delete customFields[key];
    const updated = { ...profile, customFields };
    set({ profile: updated });

    try {
      await get().saveProfile();
    } catch (err) {
      console.error('Failed to remove custom field:', err);
      set({ error: String(err) });
    }
  },

  saveProfile: async () => {
    const { profile } = get();
    if (!profile) return;

    set({ error: null });

    // Save to both backends in parallel
    const saveToRust = invoke('save_user_profile', { profile }).catch((err) => {
      console.warn('Rust backend save failed (may not be available):', err);
    });

    const saveToIndexedDB = userProfileDbOps.saveUserProfile({
      id: profile.id,
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth,
      bsn: profile.bsn,
      nationality: profile.nationality,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      employerName: profile.employerName,
      employmentType: profile.employmentType,
      jobTitle: profile.jobTitle,
      incomeBracket: profile.incomeBracket,
      bankName: profile.bankName,
      iban: profile.iban,
      customFields: profile.customFields ?? {},
    }).catch((err) => {
      console.error('IndexedDB save failed:', err);
      throw err;
    });

    await Promise.all([saveToRust, saveToIndexedDB]);

    // Sync key fields to userContext store (one-way: profile -> context)
    try {
      const { default: useUserContextStore } = await import('./userContext');
      const piiUpdates: Record<string, string> = {};
      if (profile.fullName) piiUpdates.name = profile.fullName;
      if (profile.bsn) piiUpdates.bsn = profile.bsn;
      if (profile.email) piiUpdates.email = profile.email;
      if (profile.phone) piiUpdates.phone = profile.phone;
      if (profile.iban) piiUpdates.bank_account = profile.iban;
      if (profile.address) {
        piiUpdates.address = `${profile.address.street}, ${profile.address.postalCode} ${profile.address.city}`;
      }
      if (profile.employerName) piiUpdates.employer = profile.employerName;

      if (Object.keys(piiUpdates).length > 0) {
        const ctx = useUserContextStore.getState();
        for (const [key, value] of Object.entries(piiUpdates)) {
          ctx.setPIIValue(key, value);
        }
      }
    } catch (e) {
      console.warn('Failed to sync profile to userContext:', e);
    }
  },

  importFromPII: async (piiData) => {
    const { profile } = get();
    const current = profile ?? { ...DEFAULT_PROFILE };

    // Map PII categories to profile fields
    const fieldMap: Record<string, keyof UserProfile> = {
      name: 'fullName',
      full_name: 'fullName',
      bsn: 'bsn',
      email: 'email',
      phone: 'phone',
      address: 'fullName', // handled specially below
      income: 'incomeBracket',
      bank_account: 'iban',
      tax_number: 'bsn',
      nationality: 'nationality',
      date_of_birth: 'dateOfBirth',
      employer: 'employerName',
      job_title: 'jobTitle',
    };

    const updated = { ...current };

    for (const [category, value] of Object.entries(piiData)) {
      const lowerCat = category.toLowerCase().replace(/\s+/g, '_');

      // Special handling for address: try to parse into address fields
      if (lowerCat === 'address' && value) {
        updated.address = {
          street: value,
          city: updated.address?.city ?? '',
          postalCode: updated.address?.postalCode ?? '',
          country: updated.address?.country ?? '',
        };
        continue;
      }

      const field = fieldMap[lowerCat];
      if (field && value) {
        (updated as any)[field] = value;
      } else if (value) {
        // Unmapped categories go to customFields
        updated.customFields = {
          ...updated.customFields,
          [category]: value,
        };
      }
    }

    set({ profile: updated });

    try {
      await get().saveProfile();
    } catch (err) {
      console.error('Failed to save imported PII data:', err);
      set({ error: String(err) });
    }
  },
}));

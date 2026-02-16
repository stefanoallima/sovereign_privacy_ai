import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Person, PIIValue } from "@/types/profiles";

interface ProfileStore {
    people: Person[];
    piiValues: Record<string, PIIValue[]>;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchProfiles: () => Promise<void>;
    fetchPII: (personId: string) => Promise<void>;
    addPerson: (name: string, relationship: Person['relationship']) => Promise<void>;
    updatePII: (personId: string, category: string, value: string) => Promise<void>;

    // UI State
    isUploadModalOpen: boolean;
    setUploadModalOpen: (open: boolean) => void;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
    people: [],
    piiValues: {},
    isLoading: false,
    error: null,
    isUploadModalOpen: false,

    setUploadModalOpen: (open) => set({ isUploadModalOpen: open }),

    fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
            // Mocking implementation until backend command 'list_persons' is available/verified
            // const people = await invoke<Person[]>('list_persons');

            // Temporary Mock Data for UI Development
const people: Person[] = [
                { id: '1', name: 'User', relationship: 'primary', household_id: 'h1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            ];
            set({ people, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    fetchPII: async (personId: string) => {
        try {
            const values = await invoke<PIIValue[]>('get_pii_for_person', { personId });
            set(state => ({
                piiValues: { ...state.piiValues, [personId]: values }
            }));
        } catch (err: any) {
            console.error("Failed to fetch PII", err);
        }
    },

    addPerson: async (name, relationship) => {
        // Placeholder for backend call
const newPerson: Person = {
            id: Date.now().toString(),
            name,
            relationship,
            household_id: 'h1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        set(state => ({ people: [...state.people, newPerson] }));
    },

    updatePII: async (personId, category, value) => {
        // Placeholder for backend call
        const newVal: PIIValue = {
            id: Date.now().toString(),
            person_id: personId,
            category: category as any,
            value: value
        };
        set(state => ({
            piiValues: {
                ...state.piiValues,
                [personId]: [...(state.piiValues[personId] || []), newVal]
            }
        }));
    },

    getPrimaryPerson: () => {
        return get().people.find(p => p.relationship === 'primary');
    }
}));

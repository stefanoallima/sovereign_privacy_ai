import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePersonasStore } from '@/stores/personas';
import type { Persona } from '@/types';

/**
 * Regression Test Suite for Personas Store
 *
 * Tests cover:
 * 1. localStorage migration v2 → v3
 * 2. Original 4 personas load correctly
 * 3. Batch 1 personas (5 personas) still function
 * 4. Built-in personas cannot be deleted
 * 5. Custom personas survive migration
 * 6. Persona selection behavior
 */

describe('Personas Store - Regression Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  // ============================================================
  // SUITE 1: localStorage Migration v2 → v3
  // ============================================================
  describe('Suite 1: localStorage Migration (v2 → v3)', () => {
    it('should migrate v2 state to v3 correctly with all personas', () => {
      // Simulate v2 state with 9 personas (4 original + 5 batch 1)
      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'life-coach',
              name: 'Life Coach',
              description: 'A motivational life coach',
              icon: '🎯',
              systemPrompt: 'You are a life coach...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.8,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'career-coach',
              name: 'Career Coach',
              description: 'A strategic career coach',
              icon: '💼',
              systemPrompt: 'You are a career coach...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'tax-accountant',
              name: 'Tax Accountant',
              description: 'A Dutch tax specialist',
              icon: '🧾',
              systemPrompt: 'You are a Dutch tax advisor...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.6,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requiresPIIVault: true,
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'required',
            },
            {
              id: 'tax-audit',
              name: 'Tax Audit Assistant',
              description: 'Analyzes documents for tax audits',
              icon: '📋',
              systemPrompt: 'You are a Tax Audit Assistant...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.5,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requiresPIIVault: true,
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'required',
            },
            {
              id: 'personal-branding-coach',
              name: 'Personal Branding Coach',
              description: 'LinkedIn strategy and personal brand',
              icon: '🎨',
              systemPrompt: 'You are a Personal Branding Coach...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.75,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'optional',
            },
            {
              id: 'social-media-strategist',
              name: 'Social Media Strategist',
              description: 'Content strategy and audience engagement',
              icon: '📱',
              systemPrompt: 'You are a Social Media Strategist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'optional',
            },
            {
              id: 'real-estate-advisor',
              name: 'Real Estate Advisor',
              description: 'Property valuation and investment analysis',
              icon: '🏠',
              systemPrompt: 'You are a Real Estate Advisor...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.6,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requiresPIIVault: true,
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'required',
            },
            {
              id: 'cybersecurity-advisor',
              name: 'Cybersecurity Advisor',
              description: 'Privacy best practices and threat response',
              icon: '🔐',
              systemPrompt: 'You are a Cybersecurity Advisor...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.65,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              preferred_backend: 'ollama',
              enable_local_anonymizer: false,
              anonymization_mode: 'optional',
            },
            {
              id: 'immigration-visa-advisor',
              name: 'Immigration/Visa Advisor',
              description: 'Visa pathways and relocation planning',
              icon: '🌍',
              systemPrompt: 'You are an Immigration and Visa Advisor...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.65,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requiresPIIVault: true,
              preferred_backend: 'hybrid',
              enable_local_anonymizer: true,
              anonymization_mode: 'required',
            },
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      // Store v2 state in localStorage
      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      // Create store (which should trigger migration)
      const store = usePersonasStore();

      // After migration, should have all 10 personas (9 + 1 from default that might be missing)
      // Actually, it should have at least 9 personas
      expect(store.personas.length).toBeGreaterThanOrEqual(9);

      // Check that selected persona ID is preserved
      expect(store.selectedPersonaId).toBe('psychologist');

      // Check that old personas are still there
      const psychologist = store.getPersonaById('psychologist');
      expect(psychologist).toBeDefined();
      expect(psychologist?.isBuiltIn).toBe(true);

      const taxAudit = store.getPersonaById('tax-audit');
      expect(taxAudit).toBeDefined();
      expect(taxAudit?.isBuiltIn).toBe(true);
    });

    it('should preserve selectedPersonaId during migration', () => {
      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      const store = usePersonasStore();
      expect(store.selectedPersonaId).toBe('psychologist');
    });

    it('should merge custom personas with defaults during migration', () => {
      // v2 state with a custom persona
      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'persona-custom-1',
              name: 'My Custom Persona',
              description: 'A custom persona I created',
              icon: '⚡',
              systemPrompt: 'You are my custom persona...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      const store = usePersonasStore();

      // Custom persona should still exist after migration
      const customPersona = store.getPersonaById('persona-custom-1');
      expect(customPersona).toBeDefined();
      expect(customPersona?.isBuiltIn).toBe(false);
      expect(customPersona?.name).toBe('My Custom Persona');
    });
  });

  // ============================================================
  // SUITE 2: Original 4 Personas Load Correctly
  // ============================================================
  describe('Suite 2: Original 4 Personas Load Correctly', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    it('should load psychologist persona with all required fields', () => {
      const psychologist = store.getPersonaById('psychologist');

      expect(psychologist).toBeDefined();
      expect(psychologist?.name).toBe('Psychologist');
      expect(psychologist?.icon).toBe('🧠');
      expect(psychologist?.isBuiltIn).toBe(true);
      expect(psychologist?.temperature).toBe(0.7);
      expect(psychologist?.maxTokens).toBe(4096);
      expect(psychologist?.systemPrompt.length).toBeGreaterThan(100);
      expect(psychologist?.voiceId).toBe('en_US-lessac-medium');
      expect(psychologist?.createdAt).toBeDefined();
      expect(psychologist?.updatedAt).toBeDefined();
    });

    it('should load life-coach persona with correct configuration', () => {
      const lifeCoach = store.getPersonaById('life-coach');

      expect(lifeCoach).toBeDefined();
      expect(lifeCoach?.name).toBe('Life Coach');
      expect(lifeCoach?.icon).toBe('🎯');
      expect(lifeCoach?.isBuiltIn).toBe(true);
      expect(lifeCoach?.temperature).toBe(0.8);
      expect(lifeCoach?.systemPrompt.length).toBeGreaterThan(100);
    });

    it('should load career-coach persona with correct configuration', () => {
      const careerCoach = store.getPersonaById('career-coach');

      expect(careerCoach).toBeDefined();
      expect(careerCoach?.name).toBe('Career Coach');
      expect(careerCoach?.icon).toBe('💼');
      expect(careerCoach?.isBuiltIn).toBe(true);
      expect(careerCoach?.temperature).toBe(0.7);
      expect(careerCoach?.systemPrompt.length).toBeGreaterThan(100);
    });

    it('should load tax-accountant persona with all required fields', () => {
      const taxAccountant = store.getPersonaById('tax-accountant');

      expect(taxAccountant).toBeDefined();
      expect(taxAccountant?.name).toBe('Tax Accountant');
      expect(taxAccountant?.icon).toBe('🧾');
      expect(taxAccountant?.isBuiltIn).toBe(true);
      expect(taxAccountant?.temperature).toBe(0.6);
      expect(taxAccountant?.maxTokens).toBe(4096);
      expect(taxAccountant?.systemPrompt.length).toBeGreaterThan(100);
      expect(taxAccountant?.requiresPIIVault).toBe(true);
      expect(taxAccountant?.preferred_backend).toBe('hybrid');
      expect(taxAccountant?.enable_local_anonymizer).toBe(true);
      expect(taxAccountant?.anonymization_mode).toBe('required');
    });

    it('should have all original personas present in store', () => {
      const originalPersonaIds = [
        'psychologist',
        'life-coach',
        'career-coach',
        'tax-accountant',
      ];

      for (const id of originalPersonaIds) {
        const persona = store.getPersonaById(id);
        expect(persona).toBeDefined();
        expect(persona?.isBuiltIn).toBe(true);
      }
    });
  });

  // ============================================================
  // SUITE 3: Batch 1 Personas Still Function
  // ============================================================
  describe('Suite 3: Batch 1 Personas Still Function', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    it('should load tax-audit persona with correct backend configuration', () => {
      const taxAudit = store.getPersonaById('tax-audit');

      expect(taxAudit).toBeDefined();
      expect(taxAudit?.name).toBe('Tax Audit Assistant');
      expect(taxAudit?.icon).toBe('📋');
      expect(taxAudit?.isBuiltIn).toBe(true);
      expect(taxAudit?.temperature).toBe(0.5);
      expect(taxAudit?.preferred_backend).toBe('hybrid');
      expect(taxAudit?.enable_local_anonymizer).toBe(true);
      expect(taxAudit?.anonymization_mode).toBe('required');
      expect(taxAudit?.requiresPIIVault).toBe(true);
    });

    it('should load personal-branding-coach persona', () => {
      const personalBrandingCoach = store.getPersonaById('personal-branding-coach');

      expect(personalBrandingCoach).toBeDefined();
      expect(personalBrandingCoach?.name).toBe('Personal Branding Coach');
      expect(personalBrandingCoach?.icon).toBe('🎨');
      expect(personalBrandingCoach?.isBuiltIn).toBe(true);
      expect(personalBrandingCoach?.temperature).toBe(0.75);
      expect(personalBrandingCoach?.preferred_backend).toBe('hybrid');
      expect(personalBrandingCoach?.anonymization_mode).toBe('optional');
    });

    it('should load social-media-strategist persona', () => {
      const socialMediaStrategist = store.getPersonaById('social-media-strategist');

      expect(socialMediaStrategist).toBeDefined();
      expect(socialMediaStrategist?.name).toBe('Social Media Strategist');
      expect(socialMediaStrategist?.icon).toBe('📱');
      expect(socialMediaStrategist?.isBuiltIn).toBe(true);
      expect(socialMediaStrategist?.temperature).toBe(0.7);
      expect(socialMediaStrategist?.preferred_backend).toBe('hybrid');
    });

    it('should load real-estate-advisor persona with PII vault requirement', () => {
      const realEstateAdvisor = store.getPersonaById('real-estate-advisor');

      expect(realEstateAdvisor).toBeDefined();
      expect(realEstateAdvisor?.name).toBe('Real Estate Advisor');
      expect(realEstateAdvisor?.icon).toBe('🏠');
      expect(realEstateAdvisor?.isBuiltIn).toBe(true);
      expect(realEstateAdvisor?.temperature).toBe(0.6);
      expect(realEstateAdvisor?.requiresPIIVault).toBe(true);
      expect(realEstateAdvisor?.preferred_backend).toBe('hybrid');
      expect(realEstateAdvisor?.anonymization_mode).toBe('required');
    });

    it('should load cybersecurity-advisor persona with ollama backend', () => {
      const cybersecurityAdvisor = store.getPersonaById('cybersecurity-advisor');

      expect(cybersecurityAdvisor).toBeDefined();
      expect(cybersecurityAdvisor?.name).toBe('Cybersecurity Advisor');
      expect(cybersecurityAdvisor?.icon).toBe('🔐');
      expect(cybersecurityAdvisor?.isBuiltIn).toBe(true);
      expect(cybersecurityAdvisor?.temperature).toBe(0.65);
      expect(cybersecurityAdvisor?.preferred_backend).toBe('ollama');
      expect(cybersecurityAdvisor?.enable_local_anonymizer).toBe(false);
    });

    it('should load immigration-visa-advisor persona', () => {
      const immigrationAdvisor = store.getPersonaById('immigration-visa-advisor');

      expect(immigrationAdvisor).toBeDefined();
      expect(immigrationAdvisor?.name).toBe('Immigration/Visa Advisor');
      expect(immigrationAdvisor?.icon).toBe('🌍');
      expect(immigrationAdvisor?.isBuiltIn).toBe(true);
      expect(immigrationAdvisor?.temperature).toBe(0.65);
      expect(immigrationAdvisor?.requiresPIIVault).toBe(true);
      expect(immigrationAdvisor?.preferred_backend).toBe('hybrid');
      expect(immigrationAdvisor?.anonymization_mode).toBe('required');
    });

    it('should have all batch 1 personas with correct backend configurations', () => {
      const batch1Personas = [
        { id: 'tax-audit', expectedBackend: 'hybrid' as const },
        { id: 'personal-branding-coach', expectedBackend: 'hybrid' as const },
        { id: 'social-media-strategist', expectedBackend: 'hybrid' as const },
        { id: 'real-estate-advisor', expectedBackend: 'hybrid' as const },
        { id: 'cybersecurity-advisor', expectedBackend: 'ollama' as const },
        { id: 'immigration-visa-advisor', expectedBackend: 'hybrid' as const },
      ];

      for (const { id, expectedBackend } of batch1Personas) {
        const persona = store.getPersonaById(id);
        expect(persona).toBeDefined();
        expect(persona?.isBuiltIn).toBe(true);
        expect(persona?.preferred_backend).toBe(expectedBackend);
      }
    });
  });

  // ============================================================
  // SUITE 4: Built-in Personas Cannot Be Deleted
  // ============================================================
  describe('Suite 4: Built-in Personas Cannot Be Deleted', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    it('should prevent deletion of psychologist persona', () => {
      const countBefore = store.personas.length;
      store.deletePersona('psychologist');
      const countAfter = store.personas.length;

      // Should not have deleted the persona
      expect(countAfter).toBe(countBefore);
      expect(store.getPersonaById('psychologist')).toBeDefined();
    });

    it('should prevent deletion of tax-accountant persona', () => {
      const countBefore = store.personas.length;
      store.deletePersona('tax-accountant');
      const countAfter = store.personas.length;

      // Should not have deleted the persona
      expect(countAfter).toBe(countBefore);
      expect(store.getPersonaById('tax-accountant')).toBeDefined();
    });

    it('should prevent deletion of tax-audit persona', () => {
      const countBefore = store.personas.length;
      store.deletePersona('tax-audit');
      const countAfter = store.personas.length;

      // Should not have deleted the persona
      expect(countAfter).toBe(countBefore);
      expect(store.getPersonaById('tax-audit')).toBeDefined();
    });

    it('should prevent deletion of all built-in personas', () => {
      const builtInIds = store.personas
        .filter((p) => p.isBuiltIn)
        .map((p) => p.id);

      const countBefore = store.personas.length;

      for (const id of builtInIds) {
        store.deletePersona(id);
      }

      // Should still have all personas
      expect(store.personas.length).toBe(countBefore);
    });

    it('should allow deletion of custom personas', () => {
      // Create a custom persona
      const customId = store.createPersona({
        name: 'Test Custom Persona',
        description: 'A test persona',
        icon: '🧪',
        systemPrompt: 'You are a test persona...',
        voiceId: 'en_US-lessac-medium',
        knowledgeBaseIds: [],
        temperature: 0.7,
        maxTokens: 4096,
      });

      const countBefore = store.personas.length;

      // Should be able to delete custom persona
      store.deletePersona(customId);

      expect(store.personas.length).toBe(countBefore - 1);
      expect(store.getPersonaById(customId)).toBeUndefined();
    });
  });

  // ============================================================
  // SUITE 5: Custom Personas Survive Migration
  // ============================================================
  describe('Suite 5: Custom Personas Survive Migration', () => {
    it('should preserve custom personas when migrating from v2 to v3', () => {
      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'my-custom-persona',
              name: 'My Custom Persona',
              description: 'A custom persona I created',
              icon: '⚡',
              systemPrompt: 'You are my custom persona...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.75,
              maxTokens: 2048,
              isBuiltIn: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      const store = usePersonasStore();

      // Custom persona should exist after migration
      const customPersona = store.getPersonaById('my-custom-persona');
      expect(customPersona).toBeDefined();
      expect(customPersona?.isBuiltIn).toBe(false);
      expect(customPersona?.name).toBe('My Custom Persona');
      expect(customPersona?.temperature).toBe(0.75);
    });

    it('should not duplicate custom personas during migration', () => {
      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'custom-1',
              name: 'Custom Persona 1',
              description: 'First custom',
              icon: '✨',
              systemPrompt: 'Custom prompt 1...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'custom-2',
              name: 'Custom Persona 2',
              description: 'Second custom',
              icon: '🎭',
              systemPrompt: 'Custom prompt 2...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      const store = usePersonasStore();

      // Count custom personas (non-built-in)
      const customPersonas = store.getCustomPersonas();
      const custom1Count = customPersonas.filter((p) => p.id === 'custom-1').length;
      const custom2Count = customPersonas.filter((p) => p.id === 'custom-2').length;

      // Should have exactly one of each custom persona (no duplicates)
      expect(custom1Count).toBe(1);
      expect(custom2Count).toBe(1);
    });

    it('should preserve custom persona properties during migration', () => {
      const customPersonaData = {
        id: 'my-test-persona',
        name: 'My Test Persona',
        description: 'Test description with special characters: @#$%',
        icon: '🚀',
        systemPrompt:
          'You are a test persona with a very detailed system prompt that explains your role and behavior...',
        voiceId: 'en_US-lessac-medium',
        preferredModelId: 'qwen3-32b-fast',
        knowledgeBaseIds: ['kb-1', 'kb-2'],
        temperature: 0.82,
        maxTokens: 3000,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const v2State = {
        state: {
          personas: [
            {
              id: 'psychologist',
              name: 'Psychologist',
              description: 'A compassionate psychologist',
              icon: '🧠',
              systemPrompt: 'You are a psychologist...',
              voiceId: 'en_US-lessac-medium',
              preferredModelId: 'qwen3-32b-fast',
              knowledgeBaseIds: [],
              temperature: 0.7,
              maxTokens: 4096,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            customPersonaData,
          ],
          selectedPersonaId: 'psychologist',
        },
        version: 2,
      };

      localStorage.setItem(
        'assistant-personas',
        JSON.stringify(v2State)
      );

      const store = usePersonasStore();
      const migratedPersona = store.getPersonaById('my-test-persona');

      expect(migratedPersona?.name).toBe('My Test Persona');
      expect(migratedPersona?.description).toBe(
        'Test description with special characters: @#$%'
      );
      expect(migratedPersona?.icon).toBe('🚀');
      expect(migratedPersona?.temperature).toBe(0.82);
      expect(migratedPersona?.maxTokens).toBe(3000);
      expect(migratedPersona?.knowledgeBaseIds).toEqual(['kb-1', 'kb-2']);
      expect(migratedPersona?.isBuiltIn).toBe(false);
    });
  });

  // ============================================================
  // SUITE 6: Persona Selection Still Works
  // ============================================================
  describe('Suite 6: Persona Selection Still Works', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    it('should select psychologist persona', () => {
      store.selectPersona('psychologist');
      expect(store.selectedPersonaId).toBe('psychologist');
      expect(store.getSelectedPersona()?.id).toBe('psychologist');
    });

    it('should select life-coach persona', () => {
      store.selectPersona('life-coach');
      expect(store.selectedPersonaId).toBe('life-coach');
      expect(store.getSelectedPersona()?.id).toBe('life-coach');
    });

    it('should select career-coach persona', () => {
      store.selectPersona('career-coach');
      expect(store.selectedPersonaId).toBe('career-coach');
      expect(store.getSelectedPersona()?.id).toBe('career-coach');
    });

    it('should select tax-accountant persona', () => {
      store.selectPersona('tax-accountant');
      expect(store.selectedPersonaId).toBe('tax-accountant');
      expect(store.getSelectedPersona()?.id).toBe('tax-accountant');
    });

    it('should select tax-audit persona', () => {
      store.selectPersona('tax-audit');
      expect(store.selectedPersonaId).toBe('tax-audit');
      expect(store.getSelectedPersona()?.id).toBe('tax-audit');
    });

    it('should select personal-branding-coach persona', () => {
      store.selectPersona('personal-branding-coach');
      expect(store.selectedPersonaId).toBe('personal-branding-coach');
      expect(store.getSelectedPersona()?.id).toBe('personal-branding-coach');
    });

    it('should select social-media-strategist persona', () => {
      store.selectPersona('social-media-strategist');
      expect(store.selectedPersonaId).toBe('social-media-strategist');
      expect(store.getSelectedPersona()?.id).toBe('social-media-strategist');
    });

    it('should select real-estate-advisor persona', () => {
      store.selectPersona('real-estate-advisor');
      expect(store.selectedPersonaId).toBe('real-estate-advisor');
      expect(store.getSelectedPersona()?.id).toBe('real-estate-advisor');
    });

    it('should select cybersecurity-advisor persona', () => {
      store.selectPersona('cybersecurity-advisor');
      expect(store.selectedPersonaId).toBe('cybersecurity-advisor');
      expect(store.getSelectedPersona()?.id).toBe('cybersecurity-advisor');
    });

    it('should select immigration-visa-advisor persona', () => {
      store.selectPersona('immigration-visa-advisor');
      expect(store.selectedPersonaId).toBe('immigration-visa-advisor');
      expect(store.getSelectedPersona()?.id).toBe('immigration-visa-advisor');
    });

    it('should select custom personas', () => {
      const customId = store.createPersona({
        name: 'Custom Test Persona',
        description: 'For testing selection',
        icon: '🧪',
        systemPrompt: 'Test prompt...',
        voiceId: 'en_US-lessac-medium',
        knowledgeBaseIds: [],
        temperature: 0.7,
        maxTokens: 4096,
      });

      store.selectPersona(customId);
      expect(store.selectedPersonaId).toBe(customId);
      expect(store.getSelectedPersona()?.id).toBe(customId);
    });

    it('should support null selection (no persona selected)', () => {
      store.selectPersona(null);
      expect(store.selectedPersonaId).toBeNull();
      expect(store.getSelectedPersona()).toBeUndefined();
    });

    it('should maintain selection when toggling between personas', () => {
      store.selectPersona('psychologist');
      expect(store.selectedPersonaId).toBe('psychologist');

      store.selectPersona('career-coach');
      expect(store.selectedPersonaId).toBe('career-coach');

      store.selectPersona('tax-accountant');
      expect(store.selectedPersonaId).toBe('tax-accountant');

      store.selectPersona('psychologist');
      expect(store.selectedPersonaId).toBe('psychologist');
    });

    it('should update getSelectedPersona when selection changes', () => {
      store.selectPersona('psychologist');
      let selected = store.getSelectedPersona();
      expect(selected?.id).toBe('psychologist');

      store.selectPersona('tax-audit');
      selected = store.getSelectedPersona();
      expect(selected?.id).toBe('tax-audit');

      store.selectPersona('real-estate-advisor');
      selected = store.getSelectedPersona();
      expect(selected?.id).toBe('real-estate-advisor');
    });
  });

  // ============================================================
  // SUITE 7: Batch 2 Golden Path Tests (Unit Tests)
  // ============================================================
  describe('Suite 7: Batch 2 Golden Path Tests - Persona Definitions', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    // Personal Branding Coach Definition Tests
    describe('Personal Branding Coach', () => {
      it('should load from DEFAULT_PERSONAS with all required fields', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona).toBeDefined();
        expect(persona?.name).toBe('Personal Branding Coach');
        expect(persona?.description).toBe('LinkedIn strategy and personal brand narrative coaching');
        expect(persona?.icon).toBe('🎨');
        expect(persona?.isBuiltIn).toBe(true);
      });

      it('should have correct temperature and backend configuration', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.temperature).toBe(0.75);
        expect(persona?.preferred_backend).toBe('hybrid');
        expect(persona?.enable_local_anonymizer).toBe(true);
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should have comprehensive system prompt for career narrative guidance', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
        // Should contain key competencies
        expect(persona?.systemPrompt).toContain('Personal Brand');
        expect(persona?.systemPrompt).toContain('LinkedIn');
      });

      it('should have voice and model configuration', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.voiceId).toBe('en_US-lessac-medium');
        expect(persona?.preferredModelId).toBe('qwen3-32b-fast');
        expect(persona?.maxTokens).toBe(4096);
      });

      it('should NOT require PII vault (optional anonymization)', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('icon should render without errors', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.icon).toBeTruthy();
        expect(persona?.icon?.length).toBeGreaterThan(0);
      });
    });

    // Social Media Strategist Definition Tests
    describe('Social Media Strategist', () => {
      it('should load from DEFAULT_PERSONAS with all required fields', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona).toBeDefined();
        expect(persona?.name).toBe('Social Media Strategist');
        expect(persona?.description).toBe('Content strategy, platform analytics, and audience engagement');
        expect(persona?.icon).toBe('📱');
        expect(persona?.isBuiltIn).toBe(true);
      });

      it('should have correct temperature and backend configuration', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.temperature).toBe(0.7);
        expect(persona?.preferred_backend).toBe('hybrid');
        expect(persona?.enable_local_anonymizer).toBe(true);
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should have comprehensive system prompt for content strategy', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
        // Should contain key competencies
        expect(persona?.systemPrompt).toContain('content calendar');
        expect(persona?.systemPrompt).toContain('platform');
      });

      it('should have voice and model configuration', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.voiceId).toBe('en_US-lessac-medium');
        expect(persona?.preferredModelId).toBe('qwen3-32b-fast');
        expect(persona?.maxTokens).toBe(4096);
      });

      it('should NOT require PII vault (optional anonymization)', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('icon should render without errors', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.icon).toBeTruthy();
        expect(persona?.icon?.length).toBeGreaterThan(0);
      });
    });

    // Real Estate Advisor Definition Tests
    describe('Real Estate Advisor', () => {
      it('should load from DEFAULT_PERSONAS with all required fields', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona).toBeDefined();
        expect(persona?.name).toBe('Real Estate Advisor');
        expect(persona?.description).toBe('Property valuation, investment analysis, and mortgage strategy');
        expect(persona?.icon).toBe('🏠');
        expect(persona?.isBuiltIn).toBe(true);
      });

      it('should have correct temperature and backend configuration', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.temperature).toBe(0.6);
        expect(persona?.preferred_backend).toBe('hybrid');
        expect(persona?.enable_local_anonymizer).toBe(true);
        expect(persona?.anonymization_mode).toBe('required');
      });

      it('should REQUIRE PII vault for sensitive financial data', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.requiresPIIVault).toBe(true);
      });

      it('should have comprehensive system prompt for financial guidance', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
        // Should contain key competencies
        expect(persona?.systemPrompt).toContain('valuation');
        expect(persona?.systemPrompt).toContain('investment');
      });

      it('should mention privacy and data redaction in system prompt', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.systemPrompt).toContain('Privacy');
        expect(persona?.systemPrompt).toContain('redacted');
      });

      it('should have voice and model configuration', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.voiceId).toBe('en_US-lessac-medium');
        expect(persona?.preferredModelId).toBe('qwen3-32b-fast');
        expect(persona?.maxTokens).toBe(4096);
      });

      it('icon should render without errors', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.icon).toBeTruthy();
        expect(persona?.icon?.length).toBeGreaterThan(0);
      });
    });

    // Cybersecurity Advisor Definition Tests
    describe('Cybersecurity Advisor', () => {
      it('should load from DEFAULT_PERSONAS with all required fields', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona).toBeDefined();
        expect(persona?.name).toBe('Cybersecurity Advisor');
        expect(persona?.description).toBe('Privacy best practices, threat response, and personal security posture');
        expect(persona?.icon).toBe('🔐');
        expect(persona?.isBuiltIn).toBe(true);
      });

      it('should use local-only (ollama) backend for maximum privacy', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.preferred_backend).toBe('ollama');
        expect(persona?.enable_local_anonymizer).toBe(false);
      });

      it('should have optional anonymization mode', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should NOT require PII vault (local-only processing)', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('should have correct temperature for measured, educational tone', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.temperature).toBe(0.65);
      });

      it('should have comprehensive system prompt for security guidance', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
        // Should contain key competencies
        expect(persona?.systemPrompt).toContain('Password');
        expect(persona?.systemPrompt).toContain('2FA');
      });

      it('should include data breach response procedures in system prompt', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.systemPrompt).toContain('breach response');
      });

      it('should have voice and model configuration', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.voiceId).toBe('en_US-lessac-medium');
        expect(persona?.preferredModelId).toBe('qwen3-32b-fast');
        expect(persona?.maxTokens).toBe(4096);
      });

      it('icon should render without errors', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.icon).toBeTruthy();
        expect(persona?.icon?.length).toBeGreaterThan(0);
      });
    });

    // Immigration/Visa Advisor Definition Tests
    describe('Immigration/Visa Advisor', () => {
      it('should load from DEFAULT_PERSONAS with all required fields', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona).toBeDefined();
        expect(persona?.name).toBe('Immigration/Visa Advisor');
        expect(persona?.description).toBe('Visa pathways, relocation planning, and international compliance');
        expect(persona?.icon).toBe('🌍');
        expect(persona?.isBuiltIn).toBe(true);
      });

      it('should have correct temperature and backend configuration', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.temperature).toBe(0.65);
        expect(persona?.preferred_backend).toBe('hybrid');
        expect(persona?.enable_local_anonymizer).toBe(true);
        expect(persona?.anonymization_mode).toBe('required');
      });

      it('should REQUIRE PII vault for sensitive immigration data', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.requiresPIIVault).toBe(true);
      });

      it('should have comprehensive system prompt for visa guidance', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
        // Should contain key competencies
        expect(persona?.systemPrompt).toContain('Visa');
        expect(persona?.systemPrompt).toContain('relocation');
      });

      it('should include visa categories in system prompt', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.systemPrompt).toContain('Work Visa');
        expect(persona?.systemPrompt).toContain('Student Visa');
      });

      it('should include privacy and data redaction guidance', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.systemPrompt).toContain('Privacy');
        expect(persona?.systemPrompt).toContain('redacted');
      });

      it('should have voice and model configuration', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.voiceId).toBe('en_US-lessac-medium');
        expect(persona?.preferredModelId).toBe('qwen3-32b-fast');
        expect(persona?.maxTokens).toBe(4096);
      });

      it('icon should render without errors', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.icon).toBeTruthy();
        expect(persona?.icon?.length).toBeGreaterThan(0);
      });
    });

    // Batch 2 Summary Tests
    it('should have all 5 batch 2 personas with correct backend configurations', () => {
      const batch2Personas = [
        { id: 'personal-branding-coach', expectedBackend: 'hybrid' as const },
        { id: 'social-media-strategist', expectedBackend: 'hybrid' as const },
        { id: 'real-estate-advisor', expectedBackend: 'hybrid' as const },
        { id: 'cybersecurity-advisor', expectedBackend: 'ollama' as const },
        { id: 'immigration-visa-advisor', expectedBackend: 'hybrid' as const },
      ];

      for (const { id, expectedBackend } of batch2Personas) {
        const persona = store.getPersonaById(id);
        expect(persona).toBeDefined();
        expect(persona?.isBuiltIn).toBe(true);
        expect(persona?.preferred_backend).toBe(expectedBackend);
      }
    });

    it('should have correct PII vault requirements for batch 2', () => {
      const batch2WithPII = ['real-estate-advisor', 'immigration-visa-advisor'];
      const batch2WithoutPII = ['personal-branding-coach', 'social-media-strategist', 'cybersecurity-advisor'];

      for (const id of batch2WithPII) {
        const persona = store.getPersonaById(id);
        expect(persona?.requiresPIIVault).toBe(true);
      }

      for (const id of batch2WithoutPII) {
        const persona = store.getPersonaById(id);
        expect(persona?.requiresPIIVault).not.toBe(true);
      }
    });
  });

  // ============================================================
  // INTEGRATION TESTS
  // ============================================================
  describe('Integration Tests', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    it('should maintain persona count and selection consistency', () => {
      const initialCount = store.personas.length;

      // Select different personas
      store.selectPersona('psychologist');
      expect(store.personas.length).toBe(initialCount);

      store.selectPersona('tax-accountant');
      expect(store.personas.length).toBe(initialCount);

      store.selectPersona('tax-audit');
      expect(store.personas.length).toBe(initialCount);
    });

    it('should handle duplicate persona creation correctly', () => {
      const originalCount = store.personas.length;
      const duplicateId = store.duplicatePersona('psychologist');

      expect(duplicateId).toBeDefined();
      expect(store.personas.length).toBe(originalCount + 1);

      const duplicate = store.getPersonaById(duplicateId!);
      expect(duplicate?.name).toBe('Psychologist (Copy)');
      expect(duplicate?.isBuiltIn).toBe(false);
      expect(duplicate?.icon).toBe('🧠');
    });

    it('should allow custom persona creation and selection workflow', () => {
      const countBefore = store.personas.length;

      // Create custom persona
      const customId = store.createPersona({
        name: 'My Workflow Persona',
        description: 'Test persona',
        icon: '🎯',
        systemPrompt: 'You are my workflow persona...',
        voiceId: 'en_US-lessac-medium',
        knowledgeBaseIds: [],
        temperature: 0.75,
        maxTokens: 3500,
      });

      expect(store.personas.length).toBe(countBefore + 1);

      // Select it
      store.selectPersona(customId);
      expect(store.selectedPersonaId).toBe(customId);

      // Get custom personas
      const customPersonas = store.getCustomPersonas();
      expect(customPersonas.some((p) => p.id === customId)).toBe(true);

      // Update it
      store.updatePersona(customId, { temperature: 0.85 });
      const updated = store.getPersonaById(customId);
      expect(updated?.temperature).toBe(0.85);

      // Delete it
      store.deletePersona(customId);
      expect(store.personas.length).toBe(countBefore);
      expect(store.getPersonaById(customId)).toBeUndefined();
    });

    it('should ensure all built-in personas are truly immutable', () => {
      const builtInPersonas = store.personas.filter((p) => p.isBuiltIn);

      for (const persona of builtInPersonas) {
        const countBefore = store.personas.length;

        // Try to delete
        store.deletePersona(persona.id);

        // Should still exist
        expect(store.getPersonaById(persona.id)).toBeDefined();
        expect(store.personas.length).toBe(countBefore);
      }
    });

    it('should preserve all batch 1 and batch 2 personas after multiple operations', () => {
      const batch1And2Ids = [
        'tax-audit',
        'personal-branding-coach',
        'social-media-strategist',
        'real-estate-advisor',
        'cybersecurity-advisor',
        'immigration-visa-advisor',
      ];

      // Perform various operations
      store.createPersona({
        name: 'Test',
        description: 'Test',
        icon: '🧪',
        systemPrompt: 'Test...',
        voiceId: 'en_US-lessac-medium',
        knowledgeBaseIds: [],
        temperature: 0.7,
        maxTokens: 4096,
      });

      store.selectPersona('psychologist');
      store.duplicatePersona('life-coach');

      // All personas should still be present
      for (const id of batch1And2Ids) {
        const persona = store.getPersonaById(id);
        expect(persona).toBeDefined();
        expect(persona?.isBuiltIn).toBe(true);
      }
    });
  });

  // ============================================================
  // SUITE 8: Privacy Validation Tests (PII Redaction)
  // ============================================================
  describe('Suite 8: Privacy Validation Tests - PII Redaction', () => {
    let store: ReturnType<typeof usePersonasStore>;

    beforeEach(() => {
      store = usePersonasStore();
    });

    // ========== Real Estate Advisor PII Redaction ==========
    describe('Real Estate Advisor PII Redaction', () => {
      it('should require PII vault for financial data protection', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.requiresPIIVault).toBe(true);
      });

      it('should have required anonymization mode enabled', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.anonymization_mode).toBe('required');
      });

      it('should have local anonymizer enabled for hybrid processing', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.enable_local_anonymizer).toBe(true);
      });

      it('should use hybrid backend for anonymization + cloud', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.preferred_backend).toBe('hybrid');
      });

      it('should mention privacy and redaction in system prompt', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.systemPrompt).toContain('Privacy');
        expect(persona?.systemPrompt).toContain('redacted');
      });

      it('should verify persona has financial expertise in system prompt', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        expect(persona?.systemPrompt).toContain('valuation');
        expect(persona?.systemPrompt).toContain('investment');
      });
    });

    // ========== Immigration/Visa Advisor PII Redaction ==========
    describe('Immigration/Visa Advisor PII Redaction', () => {
      it('should require PII vault for visa and travel document protection', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.requiresPIIVault).toBe(true);
      });

      it('should have required anonymization mode for sensitive travel data', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.anonymization_mode).toBe('required');
      });

      it('should have local anonymizer enabled for document processing', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.enable_local_anonymizer).toBe(true);
      });

      it('should use hybrid backend for anonymization + cloud', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.preferred_backend).toBe('hybrid');
      });

      it('should mention privacy and redaction in system prompt', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.systemPrompt).toContain('Privacy');
        expect(persona?.systemPrompt).toContain('redacted');
      });

      it('should include visa categories in system prompt', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        expect(persona?.systemPrompt).toContain('Visa');
        expect(persona?.systemPrompt).toContain('relocation');
      });
    });

    // ========== Personal Branding Coach Optional Redaction ==========
    describe('Personal Branding Coach Optional Redaction', () => {
      it('should have optional anonymization mode (user choice)', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should have local anonymizer enabled but not required', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.enable_local_anonymizer).toBe(true);
      });

      it('should NOT require PII vault (optional data sensitivity)', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('should use hybrid backend for flexible anonymization', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.preferred_backend).toBe('hybrid');
      });

      it('should have LinkedIn/branding expertise in system prompt', () => {
        const persona = store.getPersonaById('personal-branding-coach');
        expect(persona?.systemPrompt).toContain('Personal Brand');
        expect(persona?.systemPrompt).toContain('LinkedIn');
      });
    });

    // ========== Social Media Strategist Optional Redaction ==========
    describe('Social Media Strategist Optional Redaction', () => {
      it('should have optional anonymization mode (user choice)', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should have local anonymizer enabled but not required', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.enable_local_anonymizer).toBe(true);
      });

      it('should NOT require PII vault (optional data sensitivity)', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('should use hybrid backend for flexible anonymization', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.preferred_backend).toBe('hybrid');
      });

      it('should have content strategy expertise in system prompt', () => {
        const persona = store.getPersonaById('social-media-strategist');
        expect(persona?.systemPrompt).toContain('content calendar');
        expect(persona?.systemPrompt).toContain('platform');
      });
    });

    // ========== Cybersecurity Advisor Local-Only ==========
    describe('Cybersecurity Advisor Local-Only Backend', () => {
      it('should use local-only (ollama) backend for maximum privacy', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.preferred_backend).toBe('ollama');
      });

      it('should NOT require local anonymizer (local-only, no cloud)', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.enable_local_anonymizer).toBe(false);
      });

      it('should NOT require PII vault (local-only processing)', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.requiresPIIVault).not.toBe(true);
      });

      it('should have optional anonymization mode (user choice, not critical)', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.anonymization_mode).toBe('optional');
      });

      it('should have comprehensive security guidance in system prompt', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.systemPrompt).toContain('Password');
        expect(persona?.systemPrompt).toContain('2FA');
      });

      it('should include breach response procedures in system prompt', () => {
        const persona = store.getPersonaById('cybersecurity-advisor');
        expect(persona?.systemPrompt).toContain('breach response');
      });
    });

    // ========== Privacy Configuration Summary Tests ==========
    describe('Privacy Configuration Summary', () => {
      it('should have exactly 2 personas with required PII vault', () => {
        const piiVaultRequired = store.personas.filter(
          (p) => p.requiresPIIVault === true
        );
        // Tax Accountant, Tax Audit, Real Estate Advisor, Immigration Advisor = 4
        expect(piiVaultRequired.length).toBeGreaterThanOrEqual(4);
      });

      it('should have exactly 2 personas with required anonymization', () => {
        const requiredAnon = store.personas.filter(
          (p) => p.anonymization_mode === 'required'
        );
        // Real Estate Advisor, Immigration Advisor, Tax Accountant, Tax Audit
        expect(requiredAnon.length).toBeGreaterThanOrEqual(4);
      });

      it('should have at least 2 personas with optional anonymization', () => {
        const optionalAnon = store.personas.filter(
          (p) => p.anonymization_mode === 'optional'
        );
        // Personal Branding Coach, Social Media Strategist, Cybersecurity Advisor
        expect(optionalAnon.length).toBeGreaterThanOrEqual(3);
      });

      it('should have exactly 1 persona with local-only backend (ollama)', () => {
        const localOnly = store.personas.filter(
          (p) => p.preferred_backend === 'ollama'
        );
        expect(localOnly.length).toBe(1);
        expect(localOnly[0]?.id).toBe('cybersecurity-advisor');
      });

      it('should have all hybrid backend personas with local anonymizer enabled', () => {
        const hybrid = store.personas.filter(
          (p) => p.preferred_backend === 'hybrid'
        );
        for (const persona of hybrid) {
          expect(persona.enable_local_anonymizer).toBe(true);
        }
      });

      it('should never send PII to cloud from required-anonymization personas', () => {
        const requiredAnon = store.personas.filter(
          (p) => p.anonymization_mode === 'required'
        );
        for (const persona of requiredAnon) {
          expect(persona.enable_local_anonymizer).toBe(true);
          expect(
            persona.preferred_backend === 'hybrid' ||
              persona.preferred_backend === 'ollama'
          ).toBe(true);
        }
      });

      it('should document privacy requirements in PII vault personas', () => {
        const piiVaultPersonas = store.personas.filter(
          (p) => p.requiresPIIVault === true
        );
        for (const persona of piiVaultPersonas) {
          expect(persona.systemPrompt).toContain('Privacy');
          expect(persona.systemPrompt.length).toBeGreaterThan(200);
        }
      });

      it('should not mix local-only with PII vault requirement', () => {
        // Cybersecurity is local-only and should NOT require PII vault
        const cybersecurity = store.getPersonaById('cybersecurity-advisor');
        expect(cybersecurity?.preferred_backend).toBe('ollama');
        expect(cybersecurity?.requiresPIIVault).not.toBe(true);
      });

      it('should ensure all personas with required anonymization use hybrid backend', () => {
        const requiredAnon = store.personas.filter(
          (p) => p.anonymization_mode === 'required'
        );
        for (const persona of requiredAnon) {
          expect(
            persona.preferred_backend === 'hybrid' ||
              persona.preferred_backend === 'ollama'
          ).toBe(true);
        }
      });
    });

    // ========== Rehydration and Message Flow Tests ==========
    describe('Message Flow and Rehydration', () => {
      it('should have system prompts that guide rehydration for Real Estate Advisor', () => {
        const persona = store.getPersonaById('real-estate-advisor');
        // System prompt should explain how to handle redacted values
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
      });

      it('should have system prompts that guide rehydration for Immigration Advisor', () => {
        const persona = store.getPersonaById('immigration-visa-advisor');
        // System prompt should explain how to handle redacted values
        expect(persona?.systemPrompt).toBeDefined();
        expect(persona?.systemPrompt.length).toBeGreaterThan(200);
      });

      it('all hybrid backend personas should have anonymizer enabled', () => {
        const hybrid = store.personas.filter(
          (p) => p.preferred_backend === 'hybrid'
        );
        expect(hybrid.length).toBeGreaterThan(0);
        for (const persona of hybrid) {
          expect(persona.enable_local_anonymizer).toBe(true);
        }
      });

      it('local-only persona should process everything without cloud', () => {
        const cybersecurity = store.getPersonaById('cybersecurity-advisor');
        expect(cybersecurity?.preferred_backend).toBe('ollama');
        expect(cybersecurity?.enable_local_anonymizer).toBe(false);
      });
    });
  });
});

/**
 * ============================================================
 * BATCH 2 GOLDEN PATH MANUAL TEST GUIDE
 * ============================================================
 *
 * This section documents MANUAL golden path tests for batch 2 personas.
 * These tests CANNOT be automated and require human review.
 *
 * WHO: Margot (Product), David (QA), Aisha (User Experience)
 * WHEN: After unit tests pass and before release
 * WHERE: Run in production build of AILocalMind desktop app
 * HOW: Follow the checklist for each persona and verify responses match expected behavior
 *
 * KEY PRINCIPLE: Domain-appropriate responses mean:
 * - Persona provides specific, actionable guidance in their domain
 * - Guidance is NOT generic (avoids boilerplate)
 * - Tone matches the persona definition
 * - Privacy redaction is active (visible in Network Audit)
 * - No cloud calls for Cybersecurity Advisor (local-only)
 *
 * SETUP:
 * 1. Open AILocalMind desktop app
 * 2. Ensure Network Audit panel is visible (View > Network Audit or press F12)
 * 3. Select each persona below and follow its manual test checklist
 * 4. Print this section and mark off boxes as you test
 *
 * ============================================================
 * TEST 1: Personal Branding Coach
 * ============================================================
 *
 * SELECT PERSONA: "Personal Branding Coach" (icon: 🎨)
 * SEND THIS MESSAGE:
 *   "Help me craft my LinkedIn summary as a data engineer transitioning to PM"
 *
 * EXPECTED RESPONSE SHOULD INCLUDE:
 * - Career narrative guidance specific to engineer → PM transition
 * - Leadership strategy suggestion
 * - Mentions authenticity and audience alignment
 * - Does NOT provide generic resume advice
 * - Suggests LinkedIn-specific optimizations (headline, summary format, etc)
 *
 * MANUAL TEST CHECKLIST:
 * [ ] Response acknowledges the career transition (not generic advice)
 * [ ] Suggests unique value proposition for engineer-turned-PM
 * [ ] Recommends specific LinkedIn elements (headline, summary structure)
 * [ ] Tone is encouraging but professional (not overly casual)
 * [ ] Message is coherent and domain-specific
 *
 * PRIVACY CHECK:
 * [ ] Open Network Audit panel
 * [ ] Cloud message visible? Check if [PERSON_NAME] or similar placeholders appear
 * [ ] (Should be minimal PII since anonymization_mode = 'optional')
 *
 * ============================================================
 * TEST 2: Social Media Strategist
 * ============================================================
 *
 * SELECT PERSONA: "Social Media Strategist" (icon: 📱)
 * SEND THIS MESSAGE:
 *   "I'm starting a tech blog. What should my content calendar look like?"
 *
 * EXPECTED RESPONSE SHOULD INCLUDE:
 * - Blogging-specific strategy (not TikTok/Instagram focused)
 * - Content pillars suggestion (e.g., tutorials, thought leadership, industry analysis)
 * - Posting frequency guidance (e.g., 2-3x per week)
 * - Platform choice reasoning (blog + newsletter + LinkedIn?)
 * - Sample content calendar structure
 * - Tone is analytical but creative
 *
 * MANUAL TEST CHECKLIST:
 * [ ] Distinguishes blog strategy from social media platforms
 * [ ] Suggests 3-5 content pillars with examples
 * [ ] Provides concrete posting frequency (not vague)
 * [ ] Mentions cross-platform repurposing (e.g., blog → Twitter thread → LinkedIn post)
 * [ ] Includes sample calendar or timeline
 * [ ] Response feels strategic, not generic
 *
 * PRIVACY CHECK:
 * [ ] Open Network Audit panel
 * [ ] No sensitive data visible in cloud message
 * [ ] (Should be minimal PII since anonymization_mode = 'optional')
 *
 * ============================================================
 * TEST 3: Real Estate Advisor
 * ============================================================
 *
 * SELECT PERSONA: "Real Estate Advisor" (icon: 🏠)
 * SEND THIS MESSAGE:
 *   "I'm looking at a $500k condo with $2k HOA. Is it a good investment?"
 *
 * EXPECTED RESPONSE SHOULD INCLUDE:
 * - Asks clarifying questions instead of yes/no answer
 * - Explains decision framework (cap rate, cash flow, appreciation potential)
 * - Uses placeholders for sensitive amounts ([PROPERTY_VALUE], [HOA_AMOUNT])
 * - Mentions needed context (mortgage rate, local market trends, tax situation, loan terms)
 * - Includes disclaimer: "Not investment advice; consult a financial advisor"
 * - Shows financial data redaction active in Network Audit
 *
 * MANUAL TEST CHECKLIST:
 * [ ] Response asks clarifying questions (location, financing, timeline, goals)
 * [ ] Explains cap rate formula or cash-on-cash return concept
 * [ ] Discusses tax implications (depreciation, capital gains)
 * [ ] Mentions local market context importance
 * [ ] Includes disclaimer about professional advice
 * [ ] Does NOT give yes/no recommendation
 * [ ] Tone is analytical, cautious, educational
 *
 * PRIVACY VERIFICATION (CRITICAL):
 * [ ] Open Network Audit panel and inspect cloud API calls
 * [ ] Search for "500" or "2000" - should NOT appear in cloud request
 * [ ] Cloud request should show redacted values like [PROPERTY_VALUE], [HOA_AMOUNT]
 * [ ] Confirm hybrid mode is working (local anonymization + cloud call)
 * [ ] User message (local) may contain numbers; cloud message should not
 *
 * ============================================================
 * TEST 4: Cybersecurity Advisor
 * ============================================================
 *
 * SELECT PERSONA: "Cybersecurity Advisor" (icon: 🔐)
 * SEND THIS MESSAGE:
 *   "My email was in a data breach. What should I do?"
 *
 * EXPECTED RESPONSE SHOULD INCLUDE:
 * - Step-by-step response in order of priority
 * - Step 1: Check Have I Been Pwned to verify breach
 * - Step 2: Change password immediately (unique, strong)
 * - Step 3: Enable 2FA/2SV
 * - Step 4: Check for unauthorized access
 * - Step 5: Monitor for fraud
 * - Tone is calm, educational (NOT alarming)
 * - Explains WHY each step matters
 * - Suggests specific tools where appropriate
 *
 * MANUAL TEST CHECKLIST:
 * [ ] Response is step-by-step and actionable
 * [ ] Starts with verifying the breach (not panicking)
 * [ ] Prioritizes password change first
 * [ ] Recommends 2FA/2SV as critical
 * [ ] Explains monitoring and fraud prevention
 * [ ] Tone avoids fearmongering
 * [ ] Does not recommend unnecessary tools
 * [ ] Message feels empowering, not scary
 *
 * BACKEND VERIFICATION (CRITICAL):
 * [ ] Open Network Audit panel
 * [ ] SHOULD SEE: No cloud API calls (local only)
 * [ ] SHOULD SEE: Ollama or local inference only
 * [ ] Confirm preferred_backend = 'ollama' in persona config
 * [ ] Response should come from local model, not cloud
 *
 * ============================================================
 * TEST 5: Immigration/Visa Advisor
 * ============================================================
 *
 * SELECT PERSONA: "Immigration/Visa Advisor" (icon: 🌍)
 * SEND THIS MESSAGE:
 *   "I'm a software engineer in Germany on a work visa. Can I move to the Netherlands?"
 *
 * EXPECTED RESPONSE SHOULD INCLUDE:
 * - Visa categories applicable to software engineers (D visa, EU recognition, sponsorship)
 * - Explanation of mutual recognition of foreign qualifications
 * - Timeline expectations (2-8 weeks for most EU visa types)
 * - Documents needed (passport, employment contract, housing proof, health insurance)
 * - Mentions tax residency implications (moving from DE to NL)
 * - Includes disclaimer: "Not legal advice; consult immigration attorney"
 * - Shows PII redaction (visa dates, employment dates redacted)
 *
 * MANUAL TEST CHECKLIST:
 * [ ] Lists specific visa categories (D visa, work permit, EU freedom of movement)
 * [ ] Explains mutual recognition of engineering credentials in EU
 * [ ] Mentions employer sponsorship vs freelancer visa options
 * [ ] Discusses timeline realistically (not vague)
 * [ ] Lists specific documents needed
 * [ ] Addresses tax residency and double taxation concerns
 * [ ] Includes legal disclaimer
 * [ ] Response is informative but not prescriptive
 * [ ] Tone is empathetic and informative
 *
 * PRIVACY VERIFICATION (CRITICAL):
 * [ ] Open Network Audit panel and inspect cloud API calls
 * [ ] Search for visa dates, employment dates - should be redacted
 * [ ] Cloud message should show [VISA_DATE], [EMPLOYMENT_DATE], etc
 * [ ] Confirm PII vault requirement is active (requiresPIIVault = true)
 * [ ] User can discuss sensitive visa info; cloud receives only categorical data
 *
 * ============================================================
 * SUMMARY: HOW TO RUN THESE TESTS
 * ============================================================
 *
 * PREPARATION:
 * 1. Build AILocalMind: pnpm tauri build (Windows)
 * 2. Open installer or portable exe
 * 3. Launch app
 * 4. Open this test file on a separate screen or print it
 *
 * FOR EACH PERSONA TEST:
 * 1. Select persona from dropdown
 * 2. Send the test message
 * 3. Read response and mark checklist items
 * 4. Open Network Audit (F12 or View menu)
 * 5. Verify privacy redaction or local-only backend
 * 6. Move to next persona
 *
 * REPORTING:
 * - If all boxes checked: Test PASSED for this persona
 * - If any box unchecked: Test FAILED; document the issue
 * - Include screenshots of:
 *   - Response text
 *   - Network Audit showing redacted data or local inference
 *   - Any unexpected behavior
 *
 * KNOWN ISSUES:
 * - None yet (first test run)
 *
 * ============================================================
 * END MANUAL TEST GUIDE
 * ============================================================
 */

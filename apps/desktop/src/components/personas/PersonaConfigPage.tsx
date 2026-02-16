/**
 * Persona Configuration Page
 *
 * Unified configuration page opened when clicking any persona.
 * Provides tabbed interface for General, Privacy, Knowledge, and Advanced settings.
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Settings,
  Shield,
  BookOpen,
  Sliders,
  Save,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { usePersonasStore } from '@/stores';
import type { Persona } from '@/types';

// Tab Components
import { PersonaGeneralTab } from './PersonaGeneralTab';
import { PersonaPrivacyTab } from './PersonaPrivacyTab';
import { PersonaKnowledgeTab } from './PersonaKnowledgeTab';
import { PersonaAdvancedTab } from './PersonaAdvancedTab';

// ==================== Types ====================

interface PersonaConfigPageProps {
  personaId: string;
  onClose: () => void;
}

type TabId = 'general' | 'privacy' | 'knowledge' | 'advanced';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ==================== Constants ====================

const TABS: Tab[] = [
  {
    id: 'general',
    label: 'General',
    icon: <Settings size={16} />,
    description: 'Name, prompt, voice settings',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: <Shield size={16} />,
    description: 'Privacy settings & PII vault',
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: <BookOpen size={16} />,
    description: 'Knowledge bases & documents',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: <Sliders size={16} />,
    description: 'Backend routing & model settings',
  },
];

// ==================== Main Component ====================

export const PersonaConfigPage: React.FC<PersonaConfigPageProps> = ({
  personaId,
  onClose,
}) => {
  const { getPersonaById, updatePersona } = usePersonasStore();
  const persona = getPersonaById(personaId);

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [pendingChanges, setPendingChanges] = useState<Partial<Persona>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Merge persona with pending changes
  const currentValues = {
    ...persona,
    ...pendingChanges,
  } as Persona;

  // Handle field changes
  const handleChange = useCallback((updates: Partial<Persona>) => {
    setPendingChanges((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    setSaveError(null);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!persona) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      updatePersona(personaId, pendingChanges);
      setPendingChanges({});
      setHasUnsavedChanges(false);
    } catch (error) {
      setSaveError(`Failed to save: ${error}`);
    } finally {
      setIsSaving(false);
    }
  }, [persona, personaId, pendingChanges, updatePersona]);

  // Reset changes
  const handleReset = useCallback(() => {
    setPendingChanges({});
    setHasUnsavedChanges(false);
    setSaveError(null);
  }, []);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Modal content
  const modalContent = !persona ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--card))] p-6 rounded-2xl">
        <p className="text-red-500">Persona not found</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg">
          Close
        </button>
      </div>
    </div>
  ) : (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Close when clicking backdrop
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-[hsl(var(--card))] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-gradient-to-r from-[hsl(var(--primary)/0.1)] to-transparent">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{persona.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">
                {persona.name}
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {persona.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {persona.isBuiltIn && (
              <span className="px-2 py-1 text-xs font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-md">
                Built-in
              </span>
            )}
            {persona.requiresPIIVault && (
              <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 rounded-md flex items-center gap-1">
                <Shield size={12} />
                Privacy Vault
              </span>
            )}
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[hsl(var(--border))]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/0.3)]'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <PersonaGeneralTab
              persona={currentValues}
              onChange={handleChange}
              isBuiltIn={persona.isBuiltIn}
            />
          )}
          {activeTab === 'privacy' && (
            <PersonaPrivacyTab
              persona={currentValues}
              onChange={handleChange}
              showPIIVault={persona.requiresPIIVault || false}
            />
          )}
          {activeTab === 'knowledge' && (
            <PersonaKnowledgeTab
              persona={currentValues}
              onChange={handleChange}
            />
          )}
          {activeTab === 'advanced' && (
            <PersonaAdvancedTab
              persona={currentValues}
              onChange={handleChange}
            />
          )}
        </div>

        {/* Footer with Save/Reset */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.1)]">
          <div className="flex items-center gap-2">
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle size={16} />
                {saveError}
              </div>
            )}
            {hasUnsavedChanges && !saveError && (
              <span className="text-sm text-amber-600 font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root level
  return createPortal(modalContent, document.body);
};

export default PersonaConfigPage;

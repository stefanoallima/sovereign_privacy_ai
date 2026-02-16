/**
 * Persona General Tab
 *
 * Basic settings: name, description, icon, system prompt, voice, model
 */

import React from 'react';
import { User, MessageSquare, Mic, Brain, Thermometer, Hash } from 'lucide-react';
import { useSettingsStore } from '@/stores';
import type { Persona } from '@/types';

interface PersonaGeneralTabProps {
  persona: Persona;
  onChange: (updates: Partial<Persona>) => void;
  isBuiltIn: boolean;
}

// Common emoji icons for personas
const PERSONA_ICONS = ['🧠', '🎯', '💼', '🧾', '🤖', '💡', '🎨', '📚', '🔬', '🌟', '🦉', '🧙'];

export const PersonaGeneralTab: React.FC<PersonaGeneralTabProps> = ({
  persona,
  onChange,
  isBuiltIn,
}) => {
  const { models } = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Identity Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-[hsl(var(--primary))]" />
          Identity
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => onChange({ name: e.target.value })}
              disabled={isBuiltIn}
              placeholder="e.g., Code Reviewer"
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PERSONA_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => onChange({ icon })}
                  disabled={isBuiltIn}
                  className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                    persona.icon === icon
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] scale-110'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--secondary)/0.3)]'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={persona.description}
            onChange={(e) => onChange({ description: e.target.value })}
            disabled={isBuiltIn}
            placeholder="Brief description of this persona's purpose"
            className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </section>

      {/* System Prompt Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <MessageSquare size={16} className="text-[hsl(var(--primary))]" />
          System Prompt
        </h3>

        <div>
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
            Instructions for the AI
          </label>
          <textarea
            value={persona.systemPrompt}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
            rows={10}
            placeholder="You are a helpful assistant..."
            className="w-full px-3 py-2 text-sm font-mono bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] resize-y"
          />
          <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            {persona.systemPrompt.length} characters
          </p>
        </div>
      </section>

      {/* Voice & Model Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Mic size={16} className="text-[hsl(var(--primary))]" />
          Voice & Model
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Voice */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Voice ID
            </label>
            <input
              type="text"
              value={persona.voiceId}
              onChange={(e) => onChange({ voiceId: e.target.value })}
              placeholder="en_US-lessac-medium"
              className="w-full px-3 py-2 text-sm font-mono bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            />
          </div>

          {/* Preferred Model */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              <Brain size={12} className="inline mr-1" />
              Preferred Model
            </label>
            <select
              value={persona.preferredModelId || ''}
              onChange={(e) => onChange({ preferredModelId: e.target.value || undefined })}
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            >
              <option value="">Use Global Default</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Generation Parameters */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Thermometer size={16} className="text-[hsl(var(--primary))]" />
          Generation Parameters
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Temperature */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Temperature: {persona.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={persona.temperature}
              onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-[hsl(var(--secondary))] rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
            />
            <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              <span>Precise (0)</span>
              <span>Creative (1)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              <Hash size={12} className="inline mr-1" />
              Max Tokens
            </label>
            <input
              type="number"
              min="100"
              max="8000"
              step="100"
              value={persona.maxTokens}
              onChange={(e) => onChange({ maxTokens: parseInt(e.target.value) || 2000 })}
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default PersonaGeneralTab;

import React, { useState } from 'react';
import type { FormField } from '../../types';
import { Bot } from 'lucide-react';

interface GapFillPromptProps {
  field: FormField;
  onSubmit: (value: string, saveToProfile: boolean) => void;
  onSkip: () => void;
}

export const GapFillPrompt: React.FC<GapFillPromptProps> = ({ field, onSubmit, onSkip }) => {
  const [value, setValue] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim(), saveToProfile);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="group relative flex gap-4 flex-row">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] shadow-sm text-lg">
          <Bot className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col max-w-[85%] items-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm leading-relaxed w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="font-semibold text-[13px] text-[hsl(var(--foreground)/0.9)]">
              Missing Information
            </span>
          </div>

          <div className="px-4 pb-4 space-y-3">
            {/* Field label */}
            <p className="text-[13px] text-[hsl(var(--foreground))]">
              The form asks for <strong>{field.label}</strong>
            </p>

            {/* Hint */}
            {field.hint && (
              <p className="text-[12px] text-[hsl(var(--muted-foreground)/0.7)] leading-relaxed">
                {field.hint}
              </p>
            )}

            {/* Input */}
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.4)] focus:outline-none focus:border-[hsl(var(--ring)/0.4)] focus:ring-2 focus:ring-[hsl(var(--ring)/0.08)]"
            />

            {/* Save checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary)/0.3)]"
              />
              <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
                Save to My Info for future use
              </span>
            </label>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={!value.trim()}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  value.trim()
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-sm'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground)/0.4)] cursor-not-allowed'
                }`}
              >
                Submit
              </button>
              <button
                onClick={onSkip}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GapFillPrompt;

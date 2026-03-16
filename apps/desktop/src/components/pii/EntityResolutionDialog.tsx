/**
 * Entity Resolution Dialog
 * Allows user to match extracted name to existing person or create new
 */

import React, { useState } from 'react';
import { Person, EntityMatch } from '@/services/pii-service';

interface EntityResolutionDialogProps {
  extractedName: string;
  matches: EntityMatch[];
  onSelect: (person: Person | 'create-new') => void;
  onCancel: () => void;
  loading?: boolean;
}

export const EntityResolutionDialog: React.FC<EntityResolutionDialogProps> = ({
  extractedName,
  matches,
  onSelect,
  onCancel,
  loading = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | 'new'>('new');

  const handleConfirm = () => {
    if (selectedIndex === 'new') {
      onSelect('create-new');
    } else {
      onSelect(matches[selectedIndex as number].person);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.95) {
      return (
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--status-safe-bg))] px-3 py-1 text-xs font-medium text-[hsl(var(--status-safe))]">
          ✓ Exact Match
        </span>
      );
    }
    if (score >= 0.9) {
      return (
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-medium text-[hsl(var(--primary))]">
          ✓ High Confidence
        </span>
      );
    }
    if (score >= 0.85) {
      return (
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--status-caution-bg))] px-3 py-1 text-xs font-medium text-[hsl(var(--status-caution))]">
          ~ Possible Match
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/0.15)]">
      <div className="w-full max-w-2xl rounded-lg bg-[hsl(var(--card))] shadow-xl">
        {/* Header */}
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--primary)/0.05)] p-6">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Who is this person?</h2>
          <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">
            We found the name: <strong>{extractedName}</strong>
          </p>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-6">
          <div className="space-y-3">
            {/* Existing Matches */}
            {matches.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-[hsl(var(--foreground-muted))]">Possible Matches</h3>
                <div className="space-y-2">
                  {matches.map((match, idx) => (
                    <label
                      key={match.person.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                        selectedIndex === idx
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--border))]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="person"
                        checked={selectedIndex === idx}
                        onChange={() => setSelectedIndex(idx)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-[hsl(var(--foreground))]">{match.person.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-[hsl(var(--foreground-muted))]">
                            {match.person.relationship}
                          </span>
                          {getConfidenceBadge(match.score)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {Math.round(match.score * 100)}%
                        </div>
                        <div className="h-2 w-16 rounded-full bg-[hsl(var(--secondary))]">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              match.score >= 0.9
                                ? 'bg-[hsl(var(--status-safe))]'
                                : match.score >= 0.85
                                ? 'bg-[hsl(var(--status-caution))]'
                                : 'bg-orange-500'
                            }`}
                            style={{ width: `${match.score * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Option */}
            <div className="border-t border-[hsl(var(--border))] pt-6">
              <h3 className="mb-3 text-sm font-medium text-[hsl(var(--foreground-muted))]">Not a match?</h3>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                  selectedIndex === 'new'
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--border))]'
                }`}
              >
                <input
                  type="radio"
                  name="person"
                  checked={selectedIndex === 'new'}
                  onChange={() => setSelectedIndex('new')}
                  className="h-4 w-4"
                />
                <div>
                  <div className="font-medium text-[hsl(var(--foreground))]">
                    Create new person: <strong>{extractedName}</strong>
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--foreground-muted))]">
                    This name will be added as a new person to your household
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 font-medium text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--secondary)/0.5)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selectedIndex === undefined}
            className="flex-1 rounded bg-[hsl(var(--primary))] px-4 py-2 font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)] disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntityResolutionDialog;

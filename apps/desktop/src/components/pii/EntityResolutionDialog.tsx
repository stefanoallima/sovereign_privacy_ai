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
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          ✓ Exact Match
        </span>
      );
    }
    if (score >= 0.9) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
          ✓ High Confidence
        </span>
      );
    }
    if (score >= 0.85) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
          ~ Possible Match
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">Who is this person?</h2>
          <p className="mt-1 text-sm text-gray-600">
            We found the name: <strong>{extractedName}</strong>
          </p>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-6">
          <div className="space-y-3">
            {/* Existing Matches */}
            {matches.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-gray-700">Possible Matches</h3>
                <div className="space-y-2">
                  {matches.map((match, idx) => (
                    <label
                      key={match.person.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                        selectedIndex === idx
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
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
                        <div className="font-medium text-gray-900">{match.person.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {match.person.relationship}
                          </span>
                          {getConfidenceBadge(match.score)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {Math.round(match.score * 100)}%
                        </div>
                        <div className="h-2 w-16 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              match.score >= 0.9
                                ? 'bg-green-500'
                                : match.score >= 0.85
                                ? 'bg-yellow-500'
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
            <div className="border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Not a match?</h3>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                  selectedIndex === 'new'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
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
                  <div className="font-medium text-gray-900">
                    Create new person: <strong>{extractedName}</strong>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    This name will be added as a new person to your household
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 bg-gray-50 p-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selectedIndex === undefined}
            className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntityResolutionDialog;

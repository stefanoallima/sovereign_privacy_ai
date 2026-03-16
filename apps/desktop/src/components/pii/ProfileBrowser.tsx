/**
 * Profile Browser Component
 * View household profiles and person information
 */

import React, { useState } from 'react';
import { Person } from '@/services/pii-service';

interface PiiValueDecrypted {
  id: string;
  category: string;
  value: string;
  source_document?: string;
  confidence_score: number;
}

interface PersonProfile {
  person: Person;
  pii_values: PiiValueDecrypted[];
}

interface ProfileBrowserProps {
  household?: {
    name: string;
    persons: PersonProfile[];
  };
  loading?: boolean;
  onEditPerson?: (person: Person) => void;
  onDeletePerson?: (person: Person) => void;
}

export const ProfileBrowser: React.FC<ProfileBrowserProps> = ({
  household,
  loading = false,
  onEditPerson,
  onDeletePerson,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(
    household?.persons[0]?.person.id || null
  );

  const selectedProfile = household?.persons.find(p => p.person.id === selectedPersonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary)/0.2)] border-t-[hsl(var(--primary))]"></div>
      </div>
    );
  }

  if (!household || household.persons.length === 0) {
    return (
      <div className="rounded-lg bg-[hsl(var(--secondary)/0.5)] p-8 text-center">
        <p className="font-medium text-[hsl(var(--foreground))]">No profiles yet</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Upload a document or add details manually to start building your privacy vault.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Persons List */}
      <div className="space-y-2">
        <h3 className="font-medium text-[hsl(var(--foreground))]">Household Members</h3>
        <div className="space-y-1">
          {household.persons.map(profile => (
            <button
              key={profile.person.id}
              onClick={() => setSelectedPersonId(profile.person.id)}
              className={`w-full rounded-lg p-3 text-left transition-colors ${
                selectedPersonId === profile.person.id
                  ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                  : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/0.8)]'
              }`}
            >
              <div className="font-medium">{profile.person.name}</div>
              <div className="text-xs text-[hsl(var(--foreground-muted))] capitalize">{profile.person.relationship}</div>
              <div className="mt-1 text-xs text-[hsl(var(--foreground-subtle))]">
                {profile.pii_values.length} field{profile.pii_values.length !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Person Details */}
      <div className="lg:col-span-2">
        {selectedProfile ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="rounded-lg bg-[hsl(var(--primary)/0.05)] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">{selectedProfile.person.name}</h2>
                  <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))] capitalize">
                    {selectedProfile.person.relationship}
                  </p>
                </div>
                <div className="flex gap-2">
                  {onEditPerson && (
                    <button
                      onClick={() => onEditPerson(selectedProfile.person)}
                      className="rounded bg-[hsl(var(--primary))] px-3 py-1 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)]"
                    >
                      Edit
                    </button>
                  )}
                  {onDeletePerson && (
                    <button
                      onClick={() => onDeletePerson(selectedProfile.person)}
                      className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PII Values */}
            <div>
              <h3 className="mb-3 font-medium text-[hsl(var(--foreground))]">Information</h3>
              <div className="space-y-3">
                {selectedProfile.pii_values.length > 0 ? (
                  selectedProfile.pii_values.map(pii => (
                    <div key={pii.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[hsl(var(--foreground-muted))] uppercase">
                            {pii.category}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="rounded bg-[hsl(var(--secondary))] px-2 py-1 font-mono text-sm text-[hsl(var(--foreground))]">
                              {pii.value}
                            </code>
                            {pii.confidence_score < 1 && (
                              <span className="text-xs text-[hsl(var(--foreground-subtle))]">
                                {Math.round(pii.confidence_score * 100)}% confidence
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {pii.source_document && (
                        <div className="mt-2 text-xs text-[hsl(var(--foreground-subtle))]">
                          Source: {pii.source_document}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-[hsl(var(--secondary)/0.5)] p-4 text-center text-sm text-[hsl(var(--foreground-muted))]">
                    No information stored for this person
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-[hsl(var(--primary)/0.05)] p-4">
              <h4 className="mb-2 text-sm font-medium text-[hsl(var(--primary))]">Profile Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[hsl(var(--primary))]">Total Fields</div>
                  <div className="text-lg font-medium text-[hsl(var(--primary))]">
                    {selectedProfile.pii_values.length}
                  </div>
                </div>
                <div>
                  <div className="text-[hsl(var(--primary))]">Last Updated</div>
                  <div className="text-sm text-[hsl(var(--primary))]">
                    {new Date(selectedProfile.person.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[hsl(var(--secondary)/0.5)] p-8 text-center">
            <p className="text-[hsl(var(--foreground-muted))]">Select a person to view their information</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileBrowser;

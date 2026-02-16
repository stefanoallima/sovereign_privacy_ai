/**
 * PII Profile Editor Component
 *
 * Full editor for managing PII values in the UserContext store.
 * The "Privacy Shield" control panel - allows users to view, edit, and manage
 * their locally stored PII values used for template re-hydration.
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  User,
  Mail,
  CreditCard,
  Building,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  Lock,
  FileText,
} from 'lucide-react';
import {
  useUserContextStore,
  selectCurrentPII,
  selectActiveProfile,
  selectAllProfiles,
  PII_FIELDS,
  getPIIFieldsByCategory,
  formatPIIForDisplay,
  validatePIIValue,
  type PIIField,
  type PIICategory,
  type UserProfile,
} from '@/stores/userContext';

// ==================== Types ====================

interface PIIProfileEditorProps {
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

// ==================== Category Icons ====================

const CATEGORY_ICONS: Record<PIICategory, React.ReactNode> = {
  personal: <User size={16} />,
  contact: <Mail size={16} />,
  financial: <CreditCard size={16} />,
  tax: <FileText size={16} />,
  third_party: <Building size={16} />,
  custom: <Plus size={16} />,
};

const CATEGORY_LABELS: Record<PIICategory, string> = {
  personal: 'Personal Information',
  contact: 'Contact Details',
  financial: 'Financial Information',
  tax: 'Tax Information',
  third_party: 'Third Party Contacts',
  custom: 'Custom Fields',
};

const CATEGORY_COLORS: Record<PIICategory, string> = {
  personal: 'text-blue-600 bg-blue-500/10',
  contact: 'text-green-600 bg-green-500/10',
  financial: 'text-amber-600 bg-amber-500/10',
  tax: 'text-purple-600 bg-purple-500/10',
  third_party: 'text-slate-600 bg-slate-500/10',
  custom: 'text-pink-600 bg-pink-500/10',
};

// ==================== Field Input Component ====================

const PIIFieldInput: React.FC<{
  field: PIIField;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  showValue: boolean;
  onToggleVisibility: () => void;
}> = ({ field, value, onChange, showValue, onToggleVisibility }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSave = () => {
    if (localValue.trim() === '') {
      onChange(undefined);
      setIsEditing(false);
      setError(undefined);
      return;
    }

    const validation = validatePIIValue(field.key, localValue);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    onChange(localValue);
    setIsEditing(false);
    setError(undefined);
  };

  const handleCancel = () => {
    setLocalValue(value || '');
    setIsEditing(false);
    setError(undefined);
  };

  const displayValue = useMemo(() => {
    if (!value) return null;
    return showValue ? value : formatPIIForDisplay(field.key, value);
  }, [value, showValue, field.key]);

  return (
    <div className="group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[hsl(var(--secondary)/0.3)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {field.label}
          </span>
          {field.isSensitive && (
            <span title="Sensitive field">
              <Lock size={10} className="text-amber-500" />
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type={field.isSensitive && !showValue ? 'password' : 'text'}
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                setError(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
              className="flex-1 px-2 py-1 text-sm bg-white dark:bg-black/20 border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {displayValue ? (
              <code className="text-sm font-mono text-[hsl(var(--foreground))] bg-[hsl(var(--secondary)/0.5)] px-2 py-0.5 rounded">
                {displayValue}
              </code>
            ) : (
              <span className="text-sm text-[hsl(var(--muted-foreground))] italic opacity-50">
                Not set
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {value && field.isSensitive && (
          <button
            onClick={onToggleVisibility}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors"
            title={showValue ? 'Hide value' : 'Show value'}
          >
            {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-colors"
            title="Edit"
          >
            <FileText size={14} />
          </button>
        )}
        {value && !isEditing && (
          <button
            onClick={() => onChange(undefined)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// ==================== Category Section Component ====================

const CategorySection: React.FC<{
  category: PIICategory;
  fields: PIIField[];
  piiValues: Record<string, any>;
  onValueChange: (key: string, value: string | undefined) => void;
  visibleFields: Set<string>;
  onToggleFieldVisibility: (key: string) => void;
  defaultExpanded?: boolean;
}> = ({
  category,
  fields,
  piiValues,
  onValueChange,
  visibleFields,
  onToggleFieldVisibility,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const filledCount = fields.filter((f) => piiValues[f.key]).length;

  return (
    <div className="border border-[hsl(var(--border)/0.5)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[hsl(var(--secondary)/0.2)] hover:bg-[hsl(var(--secondary)/0.3)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${CATEGORY_COLORS[category]}`}>
            {CATEGORY_ICONS[category]}
          </div>
          <div className="text-left">
            <span className="font-semibold text-sm text-[hsl(var(--foreground))]">
              {CATEGORY_LABELS[category]}
            </span>
            <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
              {filledCount}/{fields.length} filled
            </span>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {isExpanded && (
        <div className="divide-y divide-[hsl(var(--border)/0.3)]">
          {fields.map((field) => (
            <PIIFieldInput
              key={field.key}
              field={field}
              value={piiValues[field.key]}
              onChange={(value) => onValueChange(field.key, value)}
              showValue={visibleFields.has(field.key)}
              onToggleVisibility={() => onToggleFieldVisibility(field.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== Profile Selector ====================

const ProfileSelector: React.FC<{
  profiles: UserProfile[];
  activeProfileId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}> = ({ profiles, activeProfileId, onSelect, onCreate, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--secondary)/0.5)] hover:bg-[hsl(var(--secondary))] rounded-xl transition-colors w-full"
      >
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center text-white font-bold text-sm">
          {activeProfile?.name.charAt(0) || '?'}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
            {activeProfile?.name || 'No Profile Selected'}
          </div>
          {activeProfile?.description && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {activeProfile.description}
            </div>
          )}
        </div>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[hsl(var(--secondary)/0.5)] ${
                  profile.id === activeProfileId ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                }`}
              >
                <button
                  onClick={() => {
                    onSelect(profile.id);
                    setIsOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2 text-left"
                >
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] flex items-center justify-center text-white font-bold text-xs">
                    {profile.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{profile.name}</span>
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(profile.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/10 text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-[hsl(var(--border))]">
            <button
              onClick={() => {
                onCreate();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)]"
            >
              <Plus size={16} />
              Create New Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Main Component ====================

export const PIIProfileEditor: React.FC<PIIProfileEditorProps> = ({
  onClose,
  compact = false,
  className = '',
}) => {
  const currentPII = useUserContextStore(selectCurrentPII);
  const activeProfile = useUserContextStore(selectActiveProfile);
  const profiles = useUserContextStore(selectAllProfiles);
  const {
    setActiveProfile,
    createProfile,
    deleteProfile,
    setPIIValue,
    clearAllPII,
    getFilledFields,
  } = useUserContextStore();

  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  const fieldsByCategory = useMemo(() => getPIIFieldsByCategory(), []);
  const filledFields = useMemo(() => getFilledFields(), [currentPII]);

  const handleToggleFieldVisibility = (key: string) => {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      createProfile(newProfileName.trim(), newProfileDesc.trim() || undefined);
      setNewProfileName('');
      setNewProfileDesc('');
      setShowCreateProfile(false);
    }
  };

  // Auto-create a default profile if none exists
  React.useEffect(() => {
    if (profiles.length === 0) {
      createProfile('My Profile', 'Default privacy profile');
    }
  }, [profiles.length, createProfile]);

  return (
    <div
      className={`bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.1)] to-[hsl(162_78%_55%/0.1)] px-5 py-4 border-b border-[hsl(var(--border)/0.3)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/10 text-green-600">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-bold text-[hsl(var(--foreground))] text-sm uppercase tracking-tight">
                Privacy Shield
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Your data stays on this device
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            <span className="text-xs font-medium text-green-600">Encrypted</span>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-2 p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="px-5 py-3 border-b border-[hsl(var(--border)/0.3)]">
        <ProfileSelector
          profiles={profiles}
          activeProfileId={activeProfile?.id || null}
          onSelect={setActiveProfile}
          onCreate={() => setShowCreateProfile(true)}
          onDelete={deleteProfile}
        />
      </div>

      {/* Create Profile Modal */}
      {showCreateProfile && (
        <div className="px-5 py-4 bg-[hsl(var(--secondary)/0.2)] border-b border-[hsl(var(--border)/0.3)]">
          <div className="space-y-3">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-black/20 border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
              autoFocus
            />
            <input
              type="text"
              value={newProfileDesc}
              onChange={(e) => setNewProfileDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-black/20 border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Profile
              </button>
              <button
                onClick={() => setShowCreateProfile(false)}
                className="px-3 py-2 text-sm font-medium bg-[hsl(var(--secondary))] rounded-lg hover:bg-[hsl(var(--secondary)/0.8)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-5 py-3 flex items-center justify-between bg-[hsl(var(--secondary)/0.1)] border-b border-[hsl(var(--border)/0.3)]">
        <div className="flex items-center gap-4">
          <div className="text-xs">
            <span className="font-bold text-[hsl(var(--foreground))]">{filledFields.length}</span>
            <span className="text-[hsl(var(--muted-foreground))]"> / {PII_FIELDS.length} fields</span>
          </div>
        </div>
        <button
          onClick={clearAllPII}
          disabled={filledFields.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} />
          Clear All
        </button>
      </div>

      {/* Field Categories */}
      <div className={`p-5 space-y-4 ${compact ? 'max-h-96' : 'max-h-[60vh]'} overflow-y-auto`}>
        {(Object.keys(fieldsByCategory) as PIICategory[]).map((category) => {
          const fields = fieldsByCategory[category];
          if (fields.length === 0) return null;

          return (
            <CategorySection
              key={category}
              category={category}
              fields={fields}
              piiValues={currentPII}
              onValueChange={setPIIValue}
              visibleFields={visibleFields}
              onToggleFieldVisibility={handleToggleFieldVisibility}
              defaultExpanded={category === 'personal' || category === 'financial'}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-[hsl(var(--secondary)/0.1)] border-t border-[hsl(var(--border)/0.3)]">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center opacity-60">
          Data encrypted with ChaCha20-Poly1305 and stored locally
        </p>
      </div>
    </div>
  );
};

export default PIIProfileEditor;

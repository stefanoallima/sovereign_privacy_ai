import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useUserProfileStore } from '../../stores/userProfile';
import { useProfileStore } from '../../stores/profiles';
import { Shield, Plus, Trash2, Save, Upload, ChevronDown, ChevronRight, User, Mail, Briefcase, CreditCard, Hash, MapPin } from 'lucide-react';
import type { UserProfileAddress } from '../../types';

const EMPLOYMENT_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
] as const;

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[hsl(var(--border)/0.5)] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-[hsl(var(--secondary)/0.3)] hover:bg-[hsl(var(--secondary)/0.5)] transition-colors text-left"
      >
        <div className="p-1 rounded-md bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
          {icon}
        </div>
        <span className="flex-1 text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wider">
          {title}
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 space-y-3 bg-[hsl(var(--card)/0.3)]">
          {children}
        </div>
      )}
    </div>
  );
}
function TextField({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const didMount = useRef(false);

  useEffect(() => {
    if (didMount.current) {
      setLocalValue(value);
    }
    didMount.current = true;
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary)/0.5)] transition-all"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary)/0.5)] transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function MyInfoPanel() {
  const {
    profile,
    isLoading,
    error,
    loadProfile,
    updateField,
    updateAddress,
    addCustomField,
    removeCustomField,
    saveProfile,
    importFromPII,
  } = useUserProfileStore();

  const { people, piiValues, fetchProfiles, fetchPII } = useProfileStore();

  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadProfile();
    fetchProfiles();
  }, [loadProfile, fetchProfiles]);

  const primaryPerson = people.find((p) => p.relationship === 'primary');
  useEffect(() => {
    if (primaryPerson) {
      fetchPII(primaryPerson.id);
    }
  }, [primaryPerson, fetchPII]);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await saveProfile();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [saveProfile]);

  const handleImportPII = useCallback(async () => {
    if (!primaryPerson) return;
    const pii = piiValues[primaryPerson.id] || [];
    if (pii.length === 0) return;
    const piiData: Record<string, string> = {};
    for (const item of pii) {
      piiData[item.category] = item.value;
    }
    await importFromPII(piiData);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [primaryPerson, piiValues, importFromPII]);

  const handleAddCustomField = useCallback(async () => {
    const key = newCustomKey.trim();
    const val = newCustomValue.trim();
    if (!key || !val) return;
    await addCustomField(key, val);
    setNewCustomKey('');
    setNewCustomValue('');
    setShowAddCustom(false);
  }, [newCustomKey, newCustomValue, addCustomField]);

  const handleAddressChange = useCallback(
    (field: keyof UserProfileAddress, value: string) => {
      const current = profile?.address ?? { street: '', city: '', postalCode: '', country: '' };
      updateAddress({ ...current, [field]: value });
    },
    [profile?.address, updateAddress]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))]">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">My Info</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading profile...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded-lg bg-[hsl(var(--secondary)/0.5)]" />
          <div className="h-10 rounded-lg bg-[hsl(var(--secondary)/0.5)]" />
          <div className="h-10 rounded-lg bg-[hsl(var(--secondary)/0.5)]" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const piiCount = primaryPerson ? (piiValues[primaryPerson.id] || []).length : 0;
  const customFieldEntries = Object.entries(profile.customFields ?? {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[hsl(var(--status-safe-bg))] text-[hsl(var(--status-safe))]">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">My Info</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Your personal details for form-filling and tax assistance
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[hsl(var(--status-safe))] bg-[hsl(var(--status-safe-bg))] px-2 py-1 rounded-lg">
          <Shield size={10} />
          Encrypted locally
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <Section title="Identity" icon={<User size={14} />}>
        <TextField label="Full Name" value={profile.fullName ?? ''} placeholder="Jan Jansen" onChange={(v) => updateField('fullName', v)} />
        <TextField label="Date of Birth" value={profile.dateOfBirth ?? ''} placeholder="1990-01-15" onChange={(v) => updateField('dateOfBirth', v)} type="date" />
        <TextField label="BSN" value={profile.bsn ?? ''} placeholder="123456789" onChange={(v) => updateField('bsn', v)} />
        <TextField label="Nationality" value={profile.nationality ?? ''} placeholder="Dutch" onChange={(v) => updateField('nationality', v)} />
      </Section>

      <Section title="Contact" icon={<Mail size={14} />}>
        <TextField label="Email" value={profile.email ?? ''} placeholder="jan@example.com" onChange={(v) => updateField('email', v)} type="email" />
        <TextField label="Phone" value={profile.phone ?? ''} placeholder="+31 6 12345678" onChange={(v) => updateField('phone', v)} type="tel" />
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={10} />
            Address
          </label>
          <div className="space-y-2 pl-2 border-l-2 border-[hsl(var(--border)/0.3)]">
            <TextField label="Street" value={profile.address?.street ?? ''} placeholder="Keizersgracht 123" onChange={(v) => handleAddressChange('street', v)} />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="City" value={profile.address?.city ?? ''} placeholder="Amsterdam" onChange={(v) => handleAddressChange('city', v)} />
              <TextField label="Postal Code" value={profile.address?.postalCode ?? ''} placeholder="1015 CJ" onChange={(v) => handleAddressChange('postalCode', v)} />
            </div>
            <TextField label="Country" value={profile.address?.country ?? ''} placeholder="Netherlands" onChange={(v) => handleAddressChange('country', v)} />
          </div>
        </div>
      </Section>
      <Section title="Employment" icon={<Briefcase size={14} />} defaultOpen={false}>
        <TextField label="Employer Name" value={profile.employerName ?? ''} placeholder="Acme B.V." onChange={(v) => updateField('employerName', v)} />
        <SelectField label="Employment Type" value={profile.employmentType ?? ''} options={EMPLOYMENT_TYPES} onChange={(v) => updateField('employmentType', v || undefined)} />
        <TextField label="Job Title" value={profile.jobTitle ?? ''} placeholder="Software Engineer" onChange={(v) => updateField('jobTitle', v)} />
      </Section>

      <Section title="Financial" icon={<CreditCard size={14} />} defaultOpen={false}>
        <TextField label="Income Bracket" value={profile.incomeBracket ?? ''} placeholder="e.g. 40,000 - 60,000" onChange={(v) => updateField('incomeBracket', v)} />
        <TextField label="Bank Name" value={profile.bankName ?? ''} placeholder="ING Bank" onChange={(v) => updateField('bankName', v)} />
        <TextField label="IBAN" value={profile.iban ?? ''} placeholder="NL00INGB0123456789" onChange={(v) => updateField('iban', v)} />
      </Section>

      <Section title="Custom Fields" icon={<Hash size={14} />} defaultOpen={customFieldEntries.length > 0}>
        {customFieldEntries.length > 0 ? (
          <div className="space-y-2">
            {customFieldEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="text-xs font-medium text-[hsl(var(--foreground))] px-3 py-2 rounded-lg bg-[hsl(var(--secondary)/0.5)] truncate">{key}</div>
                  <div className="text-xs text-[hsl(var(--foreground))] px-3 py-2 rounded-lg bg-[hsl(var(--secondary)/0.3)] truncate">{value}</div>
                </div>
                <button
                  onClick={() => removeCustomField(key)}
                  className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  title={"Remove " + key}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
            No custom fields yet. Add any additional data you want available for form-filling.
          </p>
        )}

        {showAddCustom ? (
          <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] p-3 space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="Field name"
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
              <input
                type="text"
                value={newCustomValue}
                onChange={(e) => setNewCustomValue(e.target.value)}
                placeholder="Value"
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCustomField}
                disabled={!newCustomKey.trim() || !newCustomValue.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Plus size={12} />
                Add Field
              </button>
              <button
                onClick={() => {
                  setShowAddCustom(false);
                  setNewCustomKey('');
                  setNewCustomValue('');
                }}
                className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-3 py-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCustom(true)}
            className="mt-1 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] py-2 rounded-lg border border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] transition-all"
          >
            <Plus size={12} />
            Add Custom Field
          </button>
        )}
      </Section>
      <div className="flex items-center gap-3 pt-2 border-t border-[hsl(var(--border)/0.5)]">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-bold hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50 transition-all"
        >
          <Save size={14} />
          {saveStatus === 'saving'
            ? 'Saving...'
            : saveStatus === 'saved'
              ? 'Saved!'
              : 'Save Profile'}
        </button>

        {piiCount > 0 && (
          <button
            onClick={handleImportPII}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/0.5)] transition-all"
            title={"Import " + piiCount + " detected PII entries into your profile"}
          >
            <Upload size={14} />
            Import from detected PII ({piiCount})
          </button>
        )}
      </div>

      <div className="rounded-lg bg-[hsl(var(--secondary)/0.3)] px-4 py-2.5 flex items-start gap-2.5">
        <Shield size={14} className="text-[hsl(var(--status-safe))] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          All data is stored locally on your device with ChaCha20-Poly1305 encryption.
          This information is used to pre-fill forms and provide personalized tax advice.
          It never leaves your machine unless you explicitly send it.
        </p>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Shield, User, Smartphone, CreditCard, Hash, MapPin, FilePlus, Plus, X, Check } from 'lucide-react';
import { PIIValue } from '@/types/profiles';
import { useProfileStore } from '@/stores/profiles';
import { useUserContextStore, selectActiveProfile } from '@/stores/userContext';

// Available PII categories for manual entry
const PII_CATEGORIES = [
    { value: 'bsn', label: 'BSN', placeholder: '123456789' },
    { value: 'phone', label: 'Phone', placeholder: '+31 6 12345678' },
    { value: 'bank_account', label: 'Bank Account (IBAN)', placeholder: 'NL00BANK0123456789' },
    { value: 'address', label: 'Address', placeholder: 'Street 123, City' },
    { value: 'income', label: 'Income', placeholder: '€50,000' },
    { value: 'tax_number', label: 'Tax Number', placeholder: 'NL123456789B01' },
    { value: 'email', label: 'Email', placeholder: 'name@example.com' },
    { value: 'name', label: 'Full Name', placeholder: 'Jan Jansen' },
];

export const PIIProfileCard: React.FC = () => {
    const { people, piiValues, fetchProfiles, fetchPII, setUploadModalOpen, updatePII } = useProfileStore();
    const primaryPerson = people.find(p => p.relationship === 'primary');
    const activeUserProfile = useUserContextStore(selectActiveProfile);
    const customTerms = activeUserProfile?.customRedactTerms || [];

    useEffect(() => {
        fetchProfiles();
    }, []);

    useEffect(() => {
        if (primaryPerson) {
            fetchPII(primaryPerson.id);
        }
    }, [primaryPerson, fetchPII]);

    // Manual entry state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCategory, setNewCategory] = useState(PII_CATEGORIES[0].value);
    const [newValue, setNewValue] = useState('');

    const handleAddPII = async () => {
        if (!primaryPerson || !newValue.trim()) return;
        await updatePII(primaryPerson.id, newCategory, newValue.trim());
        setNewValue('');
        setShowAddForm(false);
        fetchPII(primaryPerson.id);
    };

    if (!primaryPerson) return null;

    const pii = piiValues[primaryPerson.id] || [];

    const getIcon = (category: PIIValue['category']) => {
        switch (category) {
            case 'bsn': return <Hash size={12} />;
            case 'phone': return <Smartphone size={12} />;
            case 'bank_account': return <CreditCard size={12} />;
            case 'address': return <MapPin size={12} />;
            default: return <User size={12} />;
        }
    };

    return (
        <div className="w-full bg-[hsl(var(--card)/0.4)] border border-[hsl(var(--border)/0.5)] rounded-2xl overflow-hidden group transition-all duration-300">
            {/* Header with animated pulse */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.05)] to-[hsl(162_78%_55%/0.05)] px-4 py-2.5 border-b border-[hsl(var(--border)/0.3)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-500/10 text-green-600">
                        <Shield size={14} />
                    </div>
                    <span className="font-bold text-[hsl(var(--foreground))] text-[10px] tracking-tight uppercase">Privacy Shield</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="Local Encryption Enabled" />
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Profile Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50% )] flex items-center justify-center text-white font-bold shadow-lg shadow-[hsl(var(--primary)/0.2)] shrink-0">
                            {primaryPerson.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-[hsl(var(--foreground))] text-sm leading-none mb-1 truncate">{primaryPerson.name}</p>
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold uppercase tracking-wider opacity-60">Local Vault</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setUploadModalOpen(true)}
                        className="p-1.5 rounded-lg bg-[hsl(var(--secondary)/0.5)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary))] hover:text-white transition-all active:scale-95 shrink-0"
                        title="Import document with PII"
                    >
                        <FilePlus size={16} />
                    </button>
                </div>

                {/* PII List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                        <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest opacity-60">Secured Data</p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-md">{pii.length} PII</span>
                            {customTerms.length > 0 && (
                                <span className="text-[9px] font-bold text-pink-600 bg-pink-500/10 px-1.5 py-0.5 rounded-md">{customTerms.length} Redaction{customTerms.length !== 1 ? 's' : ''}</span>
                            )}
                        </div>
                    </div>

                    {/* Manual Entry Form */}
                    {showAddForm && (
                        <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] p-3 space-y-2 mb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-[hsl(var(--primary))] uppercase">Add Entry</span>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                            <select
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                            >
                                {PII_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                placeholder={PII_CATEGORIES.find(c => c.value === newCategory)?.placeholder || 'Enter value'}
                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPII()}
                            />
                            <button
                                onClick={handleAddPII}
                                disabled={!newValue.trim()}
                                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <Check size={12} />
                                Save to Vault
                            </button>
                        </div>
                    )}

                    {pii.length === 0 && !showAddForm ? (
                        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-center group-hover:border-[hsl(var(--primary)/0.3)] transition-colors">
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic opacity-50">Vault is empty.</p>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="text-[9px] font-bold text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                >
                                    <Plus size={10} />
                                    Add manually
                                </button>
                                <span className="text-[8px] text-[hsl(var(--muted-foreground))]">or</span>
                                <button
                                    onClick={() => setUploadModalOpen(true)}
                                    className="text-[9px] font-bold text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                >
                                    <FilePlus size={10} />
                                    Upload doc
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* PII List (when there are values) */}
                    {pii.length > 0 && (
                        <>
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                {pii.map(item => (
                                    <div key={item.id} className="flex items-center gap-2.5 text-xs bg-[hsl(var(--secondary)/0.3)] hover:bg-[hsl(var(--secondary)/0.5)] px-2.5 py-2 rounded-xl border border-transparent hover:border-[hsl(var(--border)/0.5)] transition-all">
                                        <div className="p-1.5 rounded-md bg-white/50 text-[hsl(var(--muted-foreground))] shadow-sm shrink-0">
                                            {getIcon(item.category)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[8px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-tighter opacity-70">{item.category.replace('_', ' ')}</span>
                                            </div>
                                            <div className="font-mono text-[10px] text-[hsl(var(--foreground))] font-medium truncate">
                                                {item.value ? item.value.replace(/./g, '•').slice(0, 10) + '...' : '******'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Add button when there are already items */}
                            {!showAddForm && (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-[9px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] py-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] transition-all"
                                >
                                    <Plus size={10} />
                                    Add Entry
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Custom Redaction Terms */}
            {customTerms.length > 0 && (
                <div className="px-4 pb-3">
                    <div className="flex items-center justify-between px-0.5 mb-2">
                        <p className="text-[9px] font-bold text-pink-600 uppercase tracking-widest opacity-80">Custom Redactions</p>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--border)/0.5)] overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[hsl(var(--secondary)/0.4)]">
                                    <th className="text-left px-2 py-1 text-[8px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Label</th>
                                    <th className="text-left px-2 py-1 text-[8px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Redacted As</th>
                                </tr>
                            </thead>
                        </table>
                        <div className="max-h-32 overflow-y-auto">
                            <table className="w-full">
                                <tbody className="divide-y divide-[hsl(var(--border)/0.2)]">
                                    {customTerms.map((term, i) => (
                                        <tr key={i} className="hover:bg-[hsl(var(--secondary)/0.3)] transition-colors">
                                            <td className="px-2 py-1.5 text-[10px] font-medium text-[hsl(var(--foreground))]">{term.label}</td>
                                            <td className="px-2 py-1.5">
                                                <code className="text-[9px] font-mono text-pink-600 dark:text-pink-400 bg-pink-500/10 px-1 py-0.5 rounded">{term.replacement}</code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Indicator */}
            <div className="px-4 py-2 bg-[hsl(var(--secondary)/0.2)] flex items-center justify-center border-t border-[hsl(var(--border)/0.2)]">
                <p className="text-[8px] text-[hsl(var(--muted-foreground))] opacity-50 font-medium text-center leading-tight">Data used locally to anonymize cloud requests</p>
            </div>
        </div>
    );
};

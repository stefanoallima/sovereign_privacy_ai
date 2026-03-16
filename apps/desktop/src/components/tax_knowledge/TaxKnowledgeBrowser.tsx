import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, BookOpen, Info, FileText } from 'lucide-react';
import { TaxConcept } from '../../types/profiles';

export const TaxKnowledgeBrowser: React.FC = () => {
    const [concepts, setConcepts] = useState<TaxConcept[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadConcepts();
    }, []);

    const loadConcepts = async () => {
        try {
            setLoading(true);
            const data = await invoke<TaxConcept[]>('list_tax_concepts');
            setConcepts(data);
        } catch (err) {
            console.error("Failed to load tax concepts", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredConcepts = concepts.filter(c =>
        c.term.toLowerCase().includes(filter.toLowerCase()) ||
        c.definition.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="p-6 h-full flex flex-col bg-[hsl(var(--secondary)/0.3)]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-[hsl(var(--foreground))]">
                        <BookOpen className="text-[hsl(var(--primary))]" />
                        Dutch Tax Knowledge Base
                    </h2>
                    <p className="text-[hsl(var(--foreground-subtle))] text-sm mt-1">
                        Understanding the 'Why' behind your accountant's requests.
                    </p>
                </div>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--foreground-subtle))]" size={20} />
                <input
                    type="text"
                    placeholder="Search tax terms (e.g. 'WOZ', 'Jaaropgaaf')..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] bg-[hsl(var(--card))] shadow-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-[hsl(var(--foreground-subtle))]">Loading knowledge base...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                    {filteredConcepts.map((concept) => (
                        <div key={concept.term} className="bg-[hsl(var(--card))] rounded-xl p-5 border border-[hsl(var(--border)/0.5)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{concept.term}</h3>
                                {concept.english_term && (
                                    <span className="text-xs font-medium px-2 py-1 bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] rounded-full">
                                        {concept.english_term}
                                    </span>
                                )}
                            </div>

                            <p className="text-[hsl(var(--foreground-muted))] text-sm mb-4 leading-relaxed">
                                {concept.definition}
                            </p>

                            <div className="space-y-3">
                                <div className="flex items-start gap-2 text-xs bg-amber-50 p-2 rounded text-amber-800 border border-amber-100">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-semibold block mb-0.5">Why is this asked?</span>
                                        {concept.why_needed}
                                    </div>
                                </div>

                                {concept.related_boxes.length > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--foreground-subtle))]">
                                        <FileText size={14} />
                                        <span>Look for: {concept.related_boxes.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredConcepts.length === 0 && (
                        <div className="col-span-full text-center py-10 text-[hsl(var(--foreground-subtle))]">
                            No concepts found matching "{filter}".
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

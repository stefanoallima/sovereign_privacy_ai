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
        <div className="p-6 h-full flex flex-col bg-gray-50/50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                        <BookOpen className="text-blue-600" />
                        Dutch Tax Knowledge Base
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Understanding the 'Why' behind your accountant's requests.
                    </p>
                </div>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search tax terms (e.g. 'WOZ', 'Jaaropgaaf')..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">Loading knowledge base...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                    {filteredConcepts.map((concept) => (
                        <div key={concept.term} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-lg font-bold text-gray-800">{concept.term}</h3>
                                {concept.english_term && (
                                    <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                                        {concept.english_term}
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
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
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <FileText size={14} />
                                        <span>Look for: {concept.related_boxes.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredConcepts.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-400">
                            No concepts found matching "{filter}".
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

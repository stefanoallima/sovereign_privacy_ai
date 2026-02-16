import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mail, ArrowRight, CheckCircle, AlertCircle, FileSearch, Sparkles } from 'lucide-react';
import { RequirementAnalysis } from '../../types/profiles';

export const AccountantRequestAnalyzer: React.FC = () => {
    const [requestText, setRequestText] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<RequirementAnalysis | null>(null);

    const handleAnalyze = async () => {
        if (!requestText.trim()) return;

        setAnalyzing(true);
        try {
            const analysis = await invoke<RequirementAnalysis>('analyze_accountant_request', {
                requestText
            });
            setResult(analysis);
        } catch (err) {
            console.error("Analysis failed", err);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-white">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileSearch className="text-purple-600" />
                    Request Analyzer
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                    Paste the email or message from your accountant below. We'll identify what they need and why.
                </p>
            </div>

            <div className="flex gap-6 h-full">
                {/* Left: Input */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="relative flex-1">
                        <textarea
                            className="w-full h-full p-4 rounded-xl border border-gray-200 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 text-base"
                            placeholder="e.g., 'Beste, graag ontvang ik de jaaropgaven van 2024 en de definitieve aanslag IB 2023...'"
                            value={requestText}
                            onChange={(e) => setRequestText(e.target.value)}
                        />
                        <div className="absolute top-4 right-4 text-gray-400">
                            <Mail size={20} />
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing || !requestText.trim()}
                        className={`
              flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all
              ${analyzing || !requestText.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'}
            `}
                    >
                        {analyzing ? (
                            <>Analyzing...</>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Analyze Request
                            </>
                        )}
                    </button>
                </div>

                {/* Right: Output */}
                <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 p-6 overflow-y-auto">
                    {!result ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                            <ArrowRight size={48} className="mb-4 opacity-20" />
                            <p>Analysis results will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100">
                                <h3 className="font-semibold text-gray-800 mb-2">AI Explanation</h3>
                                <p className="text-gray-600 text-sm leading-relaxed">{result.explanation}</p>
                                <div className="mt-2 text-xs text-purple-600 font-medium">Confidence: {result.confidence}</div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <CheckCircle size={16} className="text-green-500" />
                                    Identified Requirements
                                </h3>
                                <div className="space-y-4">
                                    {result.concepts_needed.map((concept, idx) => {
                                        const getRetrievalLink = (term: string) => {
                                            const t = term.toLowerCase();
                                            if (t.includes('bsn')) return { label: 'MijnOverheid', url: 'https://mijn.overheid.nl/' };
                                            if (t.includes('jaaropgaaf')) return { label: 'Employer Portal', url: '#' };
                                            if (t.includes('woz')) return { label: 'WOZ-waardeloket', url: 'https://www.wozwaardeloket.nl/' };
                                            if (t.includes('inkomstenbelasting')) return { label: 'Mijn Belastingdienst', url: 'https://mijn.belastingdienst.nl/' };
                                            if (t.includes('dividend')) return { label: 'Bank Portal', url: '#' };
                                            if (t.includes('zorgtoeslag')) return { label: 'Toeslagen.nl', url: 'https://www.belastingdienst.nl/rekenhulpen/toeslagen/' };
                                            return { label: 'Official Website', url: 'https://www.belastingdienst.nl/' };
                                        };

                                        const link = getRetrievalLink(concept.term);

                                        return (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-purple-200 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="font-bold text-gray-900 text-lg">{concept.term}</span>
                                                        {concept.english_term && <span className="ml-2 text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">{concept.english_term}</span>}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{concept.definition}</p>

                                                <div className="space-y-2">
                                                    <div className="text-xs bg-purple-50 text-purple-700 p-2.5 rounded-lg flex items-start gap-2 border border-purple-100/50">
                                                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                        <div>
                                                            <span className="font-semibold">Why needed:</span> {concept.why_needed}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                                        <span className="text-xs text-gray-400">Where to get this:</span>
                                                        <a
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
                                                        >
                                                            {link.label}
                                                            <ArrowRight size={12} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

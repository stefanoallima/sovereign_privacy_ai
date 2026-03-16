import React, { useState } from 'react';
import { TaxKnowledgeBrowser } from './TaxKnowledgeBrowser';
import { AccountantRequestAnalyzer } from './AccountantRequestAnalyzer';
import { BookOpen, FileSearch } from 'lucide-react';

export const TaxAuditLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'analyzer' | 'knowledge'>('analyzer');

    return (
        <div className="flex flex-col h-full bg-[hsl(var(--secondary)/0.5)]">
            <div className="bg-[hsl(var(--card))] border-b px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Tax Audit Assistant</h1>

                <div className="flex bg-[hsl(var(--secondary))] p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('analyzer')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'analyzer'
                                ? 'bg-[hsl(var(--card))] text-[hsl(var(--violet))] shadow-sm'
                                : 'text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        <FileSearch size={16} />
                        Request Analyzer
                    </button>

                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'knowledge'
                                ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm'
                                : 'text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        <BookOpen size={16} />
                        Knowledge Base
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'analyzer' ? <AccountantRequestAnalyzer /> : <TaxKnowledgeBrowser />}
            </div>
        </div>
    );
};

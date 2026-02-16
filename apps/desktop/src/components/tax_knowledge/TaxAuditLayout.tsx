import React, { useState } from 'react';
import { TaxKnowledgeBrowser } from './TaxKnowledgeBrowser';
import { AccountantRequestAnalyzer } from './AccountantRequestAnalyzer';
import { BookOpen, FileSearch } from 'lucide-react';

export const TaxAuditLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'analyzer' | 'knowledge'>('analyzer');

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800">Tax Audit Assistant</h1>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('analyzer')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'analyzer'
                                ? 'bg-white text-purple-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FileSearch size={16} />
                        Request Analyzer
                    </button>

                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'knowledge'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
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

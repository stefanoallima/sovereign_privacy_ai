import { useState } from "react";
import { BookOpen, FileSearch } from "lucide-react";
import { TaxKnowledgeBrowser } from "../tax_knowledge/TaxKnowledgeBrowser";
import { AccountantRequestAnalyzer } from "../tax_knowledge/AccountantRequestAnalyzer";

type TaxSubTab = "knowledge" | "analyzer";

export function TaxKnowledgeSettings() {
  const [activeTab, setActiveTab] = useState<TaxSubTab>("knowledge");

  return (
    <div className="flex flex-col h-full">
      <div>
        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Tax Knowledge</h2>
        <p className="text-sm text-[hsl(var(--foreground-subtle))] mt-1">
          Browse Dutch tax concepts and analyze accountant requests.
        </p>
      </div>

      <div className="mt-6 inline-flex bg-[hsl(var(--secondary))] p-1 rounded-lg self-start">
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "knowledge"
              ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm"
              : "text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground))]"
          }`}
          aria-pressed={activeTab === "knowledge"}
        >
          <BookOpen size={16} />
          Knowledge Base
        </button>
        <button
          onClick={() => setActiveTab("analyzer")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "analyzer"
              ? "bg-[hsl(var(--card))] text-[hsl(var(--violet))] shadow-sm"
              : "text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground))]"
          }`}
          aria-pressed={activeTab === "analyzer"}
        >
          <FileSearch size={16} />
          Request Analyzer
        </button>
      </div>

      <div className="flex-1 mt-6 overflow-hidden rounded-lg border border-[hsl(var(--border))] min-h-[480px]">
        {activeTab === "knowledge" ? <TaxKnowledgeBrowser /> : <AccountantRequestAnalyzer />}
      </div>
    </div>
  );
}

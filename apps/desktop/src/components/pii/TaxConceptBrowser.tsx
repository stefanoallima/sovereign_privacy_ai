/**
 * Tax Concept Browser Component
 * View Dutch tax concepts and definitions
 */

import React, { useState, useEffect } from 'react';
import { TaxConcept, listTaxConcepts, analyzeAccountantRequest, RequirementAnalysis } from '@/services/pii-service';

interface TaxConceptBrowserProps {
  onConceptSelected?: (concept: TaxConcept) => void;
}

export const TaxConceptBrowser: React.FC<TaxConceptBrowserProps> = ({ onConceptSelected }) => {
  const [concepts, setConcepts] = useState<TaxConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<TaxConcept | null>(null);
  const [requestText, setRequestText] = useState('');
  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConcepts();
  }, []);

  const loadConcepts = async () => {
    try {
      setLoading(true);
      const items = await listTaxConcepts();
      setConcepts(items);
      if (items.length > 0) {
        setSelectedConcept(items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeRequest = async () => {
    if (!requestText.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const result = await analyzeAccountantRequest(requestText);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Concepts List */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-900">Tax Concepts</h3>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {concepts.map(concept => (
            <button
              key={concept.term}
              onClick={() => {
                setSelectedConcept(concept);
                onConceptSelected?.(concept);
              }}
              className={`w-full rounded-lg p-2 text-left text-sm transition-colors ${
                selectedConcept?.term === concept.term
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              <div className="font-medium">{concept.term}</div>
              {concept.english_term && (
                <div className="text-xs text-gray-600">{concept.english_term}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Analyze Request Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-medium text-gray-900">Analyze Accountant Request</h3>
          <textarea
            value={requestText}
            onChange={e => setRequestText(e.target.value)}
            placeholder="Paste accountant's request here..."
            className="w-full rounded border border-gray-300 p-2 text-sm"
            rows={3}
          />
          <button
            onClick={handleAnalyzeRequest}
            disabled={loading || !requestText.trim()}
            className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>

          {error && (
            <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          {analysis && (
            <div className="mt-3 space-y-2">
              <div className="rounded bg-blue-50 p-3">
                <div className="text-sm text-blue-900">{analysis.explanation}</div>
                <div className="mt-2 text-xs text-blue-600">
                  Confidence: <span className="font-medium">{analysis.confidence}</span>
                </div>
              </div>

              {analysis.concepts_needed.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 uppercase">Concepts Found:</div>
                  <div className="mt-1 space-y-1">
                    {analysis.concepts_needed.map(concept => (
                      <button
                        key={concept.term}
                        onClick={() => setSelectedConcept(concept)}
                        className="block rounded bg-yellow-50 p-2 text-left text-xs text-yellow-900 hover:bg-yellow-100"
                      >
                        <strong>{concept.term}</strong> - {concept.why_needed}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Concept Details */}
        {selectedConcept && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3">
              <h3 className="text-xl font-bold text-gray-900">{selectedConcept.term}</h3>
              {selectedConcept.english_term && (
                <div className="text-sm text-gray-600">{selectedConcept.english_term}</div>
              )}
            </div>

            <div className="space-y-4">
              {/* Definition */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700">Definition</h4>
                <p className="text-sm text-gray-900">{selectedConcept.definition}</p>
              </div>

              {/* Why Needed */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700">Why It's Needed</h4>
                <p className="text-sm text-gray-900">{selectedConcept.why_needed}</p>
              </div>

              {/* Related Boxes */}
              {selectedConcept.related_boxes && selectedConcept.related_boxes.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700">Related Tax Boxes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedConcept.related_boxes.map(box => (
                      <span
                        key={box}
                        className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                      >
                        {box}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tax Code Reference */}
              <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
                Reference: Dutch Income Tax (Inkomstenbelasting) regulations
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxConceptBrowser;

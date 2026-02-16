/**
 * Privacy Indicator Component
 * Shows which data stays local vs goes to cloud
 */

import React from 'react';
import { PiiMapping } from '@/services/pii-service';

interface PrivacyIndicatorProps {
  mappings: PiiMapping[];
  anonymized: boolean;
  requestedByNebius: boolean;
  className?: string;
}

export const PrivacyIndicator: React.FC<PrivacyIndicatorProps> = ({
  mappings,
  anonymized,
  requestedByNebius,
  className = '',
}) => {
  const categoryCount = new Set(mappings.map(m => m.pii_category)).size;

  return (
    <div className={`rounded-lg border border-blue-200 bg-blue-50 p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg font-semibold text-blue-900">Privacy Status</span>
      </div>

      <div className="space-y-3">
        {/* Local PII Storage */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-green-100">
            <span className="text-sm">🔒</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-green-900">Local (Encrypted)</div>
            <div className="text-sm text-green-700">
              {mappings.length} PII value{mappings.length !== 1 ? 's' : ''} stored
              encrypted on your device
            </div>
            {categoryCount > 0 && (
              <div className="mt-1 text-xs text-green-600">
                Categories: {Array.from(new Set(mappings.map(m => m.pii_category)))
                  .join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Cloud Request Status */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-blue-100">
            <span className="text-sm">☁️</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-blue-900">Cloud (Anonymized)</div>
            {anonymized ? (
              <div className="text-sm text-blue-700">
                {requestedByNebius
                  ? 'Anonymized request sent to Nebius for analysis'
                  : 'Ready to send anonymized request to cloud'}
              </div>
            ) : (
              <div className="text-sm text-yellow-700">
                Document not yet anonymized
              </div>
            )}
          </div>
        </div>

        {/* Anonymization Status */}
        <div className="mt-3 border-t border-blue-200 pt-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-block h-2 w-2 rounded-full ${anonymized ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span className="text-blue-800">
              {anonymized
                ? '✓ Anonymization verified - No sensitive data in requests'
                : '⚠ Anonymization pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="mt-4 rounded bg-white p-3 text-xs text-gray-700">
        <strong className="text-blue-900">Privacy Guarantee:</strong> Your BSN, tax ID, phone,
        and address never leave your device in plain text. Only anonymized versions are sent
        to cloud services.
      </div>
    </div>
  );
};

export default PrivacyIndicator;

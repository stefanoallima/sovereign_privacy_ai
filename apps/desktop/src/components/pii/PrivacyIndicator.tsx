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
    <div className={`rounded-lg border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.05)] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg font-semibold text-[hsl(var(--primary))]">Privacy Status</span>
      </div>

      <div className="space-y-3">
        {/* Local PII Storage */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-[hsl(var(--status-safe-bg))]">
            <span className="text-sm">🔒</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-[hsl(var(--status-safe))]">Local (Encrypted)</div>
            <div className="text-sm text-[hsl(var(--status-safe))]">
              {mappings.length} PII value{mappings.length !== 1 ? 's' : ''} stored
              encrypted on your device
            </div>
            {categoryCount > 0 && (
              <div className="mt-1 text-xs text-[hsl(var(--status-safe))]">
                Categories: {Array.from(new Set(mappings.map(m => m.pii_category)))
                  .join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Cloud Request Status */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-[hsl(var(--primary)/0.1)]">
            <span className="text-sm">☁️</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-[hsl(var(--primary))]">Cloud (Anonymized)</div>
            {anonymized ? (
              <div className="text-sm text-[hsl(var(--primary))]">
                {requestedByNebius
                  ? 'Anonymized request sent to Nebius for analysis'
                  : 'Ready to send anonymized request to cloud'}
              </div>
            ) : (
              <div className="text-sm text-[hsl(var(--status-caution))]">
                Document not yet anonymized
              </div>
            )}
          </div>
        </div>

        {/* Anonymization Status */}
        <div className="mt-3 border-t border-[hsl(var(--primary)/0.2)] pt-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-block h-2 w-2 rounded-full ${anonymized ? 'bg-[hsl(var(--status-safe))]' : 'bg-[hsl(var(--status-caution))]'}`}></span>
            <span className="text-[hsl(var(--primary))]">
              {anonymized
                ? '✓ Anonymization verified - No sensitive data in requests'
                : '⚠ Anonymization pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="mt-4 rounded bg-[hsl(var(--card))] p-3 text-xs text-[hsl(var(--foreground-muted))]">
        <strong className="text-[hsl(var(--primary))]">Privacy Guarantee:</strong> Your BSN, tax ID, phone,
        and address never leave your device in plain text. Only anonymized versions are sent
        to cloud services.
      </div>
    </div>
  );
};

export default PrivacyIndicator;

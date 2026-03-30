/**
 * Document Upload Widget
 * Handles document upload and full PII extraction workflow
 */

import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useUserContextStore } from '@/stores/userContext';
import { parseDocument, extractPiiFromDocument, extractPiiDynamic, anonymizeText, validateAnonymization, findPersonMatches, PIIExtraction, DynamicPIIExtraction, Person, EntityMatch, ParsedDocument, AnonymizationResult, ValidationResult } from '@/services/pii-service';
import PiiExtractionDialog from './PiiExtractionDialog';
import DynamicPiiDialog from './DynamicPiiDialog';
import EntityResolutionDialog from './EntityResolutionDialog';
import PrivacyIndicator from './PrivacyIndicator';

interface DocumentUploadWidgetProps {
  conversationId: string;
  existingPersons: Person[];
  onProcessComplete?: (result: ProcessingResult) => void;
}

export interface ProcessingResult {
  document: ParsedDocument;
  pii: PIIExtraction;
  anonymized: AnonymizationResult;
  validation: ValidationResult;
}

enum UploadStep {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  EXTRACTING = 'extracting',
  PII_CONFIRMATION = 'pii_confirmation',
  ENTITY_RESOLUTION = 'entity_resolution',
  DYNAMIC_PII_CONFIRMATION = 'dynamic_pii_confirmation',
  ANONYMIZING = 'anonymizing',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export const DocumentUploadWidget: React.FC<DocumentUploadWidgetProps> = ({
  conversationId,
  existingPersons,
  onProcessComplete,
}) => {
  const [step, setStep] = useState<UploadStep>(UploadStep.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [pii, setPii] = useState<PIIExtraction | null>(null);
  const [nameMatches, setNameMatches] = useState<EntityMatch[]>([]);
  const [anonymized, setAnonymized] = useState<AnonymizationResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [dynamicPii, setDynamicPii] = useState<DynamicPIIExtraction | null>(null);

  const handleFileSelect = async () => {
    setStep(UploadStep.UPLOADING);
    setError(null);

    try {
      // Use Tauri's file dialog to get proper file path
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Documents',
          extensions: ['pdf', 'docx', 'doc', 'txt']
        }]
      });

      if (!selected) {
        setStep(UploadStep.IDLE);
        return;
      }

      const filePath = typeof selected === 'string' ? selected : selected[0];

      // Parse document
      setStep(UploadStep.EXTRACTING);
      const parsedDoc = await parseDocument(filePath);
      setDocument(parsedDoc);

      // Try dynamic extraction first (supports arbitrary columns + multiple records)
      try {
        const dynamicResult = await extractPiiDynamic(parsedDoc.text_content);
        if (dynamicResult.records.length > 0 && dynamicResult.columns.length > 0) {
          setDynamicPii(dynamicResult);
          setStep(UploadStep.DYNAMIC_PII_CONFIRMATION);
          return;
        }
      } catch {
        // Fall back to fixed-schema extraction
      }

      // Fallback: fixed-schema PII extraction
      const extractedPii = await extractPiiFromDocument(parsedDoc.text_content);
      setPii(extractedPii);

      // If name was extracted, find matches
      if (extractedPii.name) {
        const matches = await findPersonMatches(extractedPii.name, existingPersons);
        setNameMatches(matches);
      }

      setStep(UploadStep.PII_CONFIRMATION);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
      setError(`Error processing document: ${msg}`);
      setStep(UploadStep.ERROR);
    }
  };

  const handlePiiConfirm = async (confirmedPii: PIIExtraction) => {
    setPii(confirmedPii);

    // If we have a name and persons, go to entity resolution
    if (confirmedPii.name && existingPersons.length > 0) {
      try {
        const matches = await findPersonMatches(confirmedPii.name, existingPersons);
        setNameMatches(matches);
        setStep(UploadStep.ENTITY_RESOLUTION);
      } catch (err) {
        // If entity resolution fails, continue to anonymization
        processAnonymization(confirmedPii);
      }
    } else {
      processAnonymization(confirmedPii);
    }
  };

  const handleEntityResolved = () => {
    if (pii) {
      processAnonymization(pii);
    }
  };

  const processAnonymization = async (piiData: PIIExtraction) => {
    if (!document) return;

    try {
      setStep(UploadStep.ANONYMIZING);

      // Anonymize
      const anonymizedResult = await anonymizeText(
        document.text_content,
        piiData,
        conversationId
      );
      setAnonymized(anonymizedResult);

      // Validate
      const validationResult = await validateAnonymization(anonymizedResult.anonymized_text);
      setValidation(validationResult);

      setStep(UploadStep.COMPLETE);

      // Call callback
      if (onProcessComplete && document && pii) {
        onProcessComplete({
          document,
          pii: piiData,
          anonymized: anonymizedResult,
          validation: validationResult,
        });
      }
    } catch (err) {
      setError(`Anonymization failed: ${err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'}`);
      setStep(UploadStep.ERROR);
    }
  };

  const handleDynamicConfirm = (selectedRecords: Record<string, string>[]) => {
    const ctx = useUserContextStore.getState();

    // Always populate PII vault from the first selected record
    // For multi-record docs, the first record is the best guess for the primary person
    if (selectedRecords.length > 0) {
      const firstRecord = selectedRecords[0];
      for (const [key, value] of Object.entries(firstRecord)) {
        if (!value || !value.trim()) continue;
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes('name') && !lowerKey.includes('sur') && !lowerKey.includes('last') && !lowerKey.includes('employer') && !lowerKey.includes('accountant')) {
          ctx.setPIIValue('name', value);
        } else if (lowerKey.includes('surname') || (lowerKey.includes('last') && lowerKey.includes('name'))) {
          ctx.setPIIValue('surname', value);
        } else if (lowerKey === 'bsn') {
          ctx.setPIIValue('bsn', value);
        } else if (lowerKey.includes('email') && !lowerKey.includes('accountant')) {
          ctx.setPIIValue('email', value);
        } else if (lowerKey.includes('phone')) {
          ctx.setPIIValue('phone', value);
        } else if (lowerKey.includes('address')) {
          ctx.setPIIValue('address', value);
        } else if (lowerKey.includes('iban')) {
          ctx.setPIIValue('iban', value);
        } else if (lowerKey.includes('income')) {
          ctx.setPIIValue('income', value);
        } else if (lowerKey.includes('salary')) {
          ctx.setPIIValue('salary', value);
        } else if (lowerKey.includes('postcode') || lowerKey.includes('postal') || lowerKey.includes('zip')) {
          ctx.setPIIValue('postcode', value);
        } else if (lowerKey.includes('city')) {
          ctx.setPIIValue('city', value);
        } else if ((lowerKey.includes('date') && lowerKey.includes('birth')) || lowerKey === 'dob') {
          ctx.setPIIValue('dateOfBirth', value);
        } else if (lowerKey.includes('tax') && lowerKey.includes('number')) {
          ctx.setPIIValue('taxNumber', value);
        } else if (lowerKey.includes('tax') && lowerKey.includes('year')) {
          ctx.setPIIValue('taxYear', value);
        } else if (lowerKey.includes('employer')) {
          ctx.setPIIValue('employerName', value);
        }
      }
    }

    // Add ALL values from ALL records as custom redaction terms
    // This ensures all names, BSNs, SSNs etc. are redacted in future conversations
    for (const record of selectedRecords) {
      for (const [key, value] of Object.entries(record)) {
        if (!value || !value.trim()) continue;
        ctx.addCustomRedactTerm(key, value);
      }
    }

    setStep(UploadStep.COMPLETE);
    setDynamicPii(null);
  };

  const handleReset = () => {
    setStep(UploadStep.IDLE);
    setError(null);
    setDocument(null);
    setPii(null);
    setNameMatches([]);
    setAnonymized(null);
    setValidation(null);
    setDynamicPii(null);
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Upload Area */}
      {step === UploadStep.IDLE && (
        <div className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-8 text-center">
          <div className="flex justify-center">
            <svg
              className="h-12 w-12 text-[hsl(var(--foreground-subtle))]"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-14-12l-4 4m0 0l4 4m-4-4h16"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-[hsl(var(--foreground))]">Upload Document with PII</h3>
          <p className="mt-2 text-sm text-[hsl(var(--foreground-muted))]">
            PDF, DOCX, or TXT files containing personal information (tax, medical, financial, identity documents)
          </p>
          <button
            onClick={handleFileSelect}
            className="mt-6 inline-block cursor-pointer rounded bg-[hsl(var(--primary))] px-4 py-2 font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)] transition-colors"
          >
            Choose File
          </button>
        </div>
      )}

      {/* Loading State */}
      {(step === UploadStep.UPLOADING || step === UploadStep.EXTRACTING || step === UploadStep.ANONYMIZING) && (
        <div className="rounded-lg bg-[hsl(var(--primary)/0.05)] p-6 text-center">
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary)/0.2)] border-t-[hsl(var(--primary))]"></div>
          </div>
          <p className="mt-4 font-medium text-[hsl(var(--primary))]">
            {step === UploadStep.UPLOADING && 'Uploading...'}
            {step === UploadStep.EXTRACTING && 'Extracting information...'}
            {step === UploadStep.ANONYMIZING && 'Anonymizing data...'}
          </p>
        </div>
      )}

      {/* PII Confirmation Dialog */}
      {step === UploadStep.PII_CONFIRMATION && pii && (
        <PiiExtractionDialog
          piiData={pii}
          documentName={document?.filename || 'Document'}
          onConfirm={handlePiiConfirm}
          onCancel={handleReset}
        />
      )}

      {/* Dynamic PII Confirmation Dialog */}
      {step === UploadStep.DYNAMIC_PII_CONFIRMATION && dynamicPii && (
        <DynamicPiiDialog
          data={dynamicPii}
          documentName={document?.filename || 'Document'}
          onConfirm={handleDynamicConfirm}
          onCancel={handleReset}
        />
      )}

      {/* Entity Resolution Dialog */}
      {step === UploadStep.ENTITY_RESOLUTION && (
        <EntityResolutionDialog
          extractedName={pii?.name || 'Unknown'}
          matches={nameMatches}
          onSelect={handleEntityResolved}
          onCancel={handleReset}
        />
      )}

      {/* Complete State */}
      {step === UploadStep.COMPLETE && !anonymized && (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            <strong>Success!</strong> Records have been imported into your local profile.
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded bg-[hsl(var(--primary))] px-4 py-2 font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)]"
          >
            Upload Another Document
          </button>
        </div>
      )}
      {step === UploadStep.COMPLETE && anonymized && validation && (
        <div className="space-y-4">
          <PrivacyIndicator
            mappings={anonymized.mappings}
            anonymized={true}
            requestedByNebius={false}
          />

          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            <strong>✓ Success!</strong> Your document has been processed and anonymized.
            {validation.is_safe && ' No sensitive data remains in the anonymized version.'}
            {!validation.is_safe && ` ⚠ Warning: ${validation.found_patterns.join(', ')} patterns detected.`}
          </div>

          <button
            onClick={handleReset}
            className="w-full rounded bg-[hsl(var(--primary))] px-4 py-2 font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)]"
          >
            Upload Another Document
          </button>
        </div>
      )}

      {/* Error State */}
      {step === UploadStep.ERROR && error && (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded bg-[hsl(var(--primary))] px-4 py-2 font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.85)]"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadWidget;

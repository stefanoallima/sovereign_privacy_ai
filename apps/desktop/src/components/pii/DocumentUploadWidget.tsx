/**
 * Document Upload Widget
 * Handles document upload and full PII extraction workflow
 */

import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { parseDocument, extractPiiFromDocument, anonymizeText, validateAnonymization, findPersonMatches, PIIExtraction, Person, EntityMatch, ParsedDocument, AnonymizationResult, ValidationResult } from '@/services/pii-service';
import PiiExtractionDialog from './PiiExtractionDialog';
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

      // Extract PII
      const extractedPii = await extractPiiFromDocument(parsedDoc.text_content);
      setPii(extractedPii);

      // If name was extracted, find matches
      if (extractedPii.name) {
        const matches = await findPersonMatches(extractedPii.name, existingPersons);
        setNameMatches(matches);
      }

      setStep(UploadStep.PII_CONFIRMATION);
    } catch (err) {
      setError(`Error processing document: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      setError(`Anonymization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep(UploadStep.ERROR);
    }
  };

  const handleReset = () => {
    setStep(UploadStep.IDLE);
    setError(null);
    setDocument(null);
    setPii(null);
    setNameMatches([]);
    setAnonymized(null);
    setValidation(null);
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Upload Area */}
      {step === UploadStep.IDLE && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 p-8 text-center">
          <div className="flex justify-center">
            <svg
              className="h-12 w-12 text-gray-400"
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
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">Upload Document with PII</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            PDF, DOCX, or TXT files containing personal information (tax, medical, financial, identity documents)
          </p>
          <button
            onClick={handleFileSelect}
            className="mt-6 inline-block cursor-pointer rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Choose File
          </button>
        </div>
      )}

      {/* Loading State */}
      {(step === UploadStep.UPLOADING || step === UploadStep.EXTRACTING || step === UploadStep.ANONYMIZING) && (
        <div className="rounded-lg bg-blue-50 p-6 text-center">
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="mt-4 font-medium text-blue-900">
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
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
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
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadWidget;

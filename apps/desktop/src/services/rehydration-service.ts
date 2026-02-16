/**
 * Re-hydration Service
 *
 * Task 3 from Privacy-First Design:
 * Cloud LLM generates templates with placeholders → Local fills in real PII values
 *
 * Flow:
 * 1. Cloud LLM generates: "Dear [ACCOUNTANT_NAME], my BSN is [BSN], income is [INCOME]..."
 * 2. This service: Replaces placeholders with actual values from user's local PII store
 * 3. Result: Ready-to-send email/document with real data
 *
 * Security:
 * - PII never leaves local machine until user explicitly sends
 * - Templates can be reviewed before re-hydration
 * - Audit trail of what was filled in
 */

// ==================== Types ====================

/**
 * Standard placeholders used in templates
 */
export const PLACEHOLDER_TYPES = {
  // Personal
  BSN: '[BSN]',
  NAME: '[NAME]',
  SURNAME: '[SURNAME]',
  FULL_NAME: '[FULL_NAME]',
  DATE_OF_BIRTH: '[DATE_OF_BIRTH]',

  // Contact
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  ADDRESS: '[ADDRESS]',
  POSTCODE: '[POSTCODE]',
  CITY: '[CITY]',

  // Financial
  INCOME: '[INCOME]',
  SALARY: '[SALARY]',
  IBAN: '[IBAN]',
  BANK_ACCOUNT: '[BANK_ACCOUNT]',

  // Tax
  TAX_NUMBER: '[TAX_NUMBER]',
  TAX_YEAR: '[TAX_YEAR]',

  // Third parties
  ACCOUNTANT_NAME: '[ACCOUNTANT_NAME]',
  ACCOUNTANT_EMAIL: '[ACCOUNTANT_EMAIL]',
  EMPLOYER_NAME: '[EMPLOYER_NAME]',

  // Dates
  CURRENT_DATE: '[CURRENT_DATE]',
  DEADLINE_DATE: '[DEADLINE_DATE]',
} as const;

export type PlaceholderType = keyof typeof PLACEHOLDER_TYPES;

/**
 * User's PII values for re-hydration
 */
export interface PIIValues {
  // Personal
  bsn?: string;
  name?: string;
  surname?: string;
  dateOfBirth?: string;

  // Contact
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  city?: string;

  // Financial
  income?: string;
  salary?: string;
  iban?: string;

  // Tax
  taxNumber?: string;
  taxYear?: string;

  // Third parties
  accountantName?: string;
  accountantEmail?: string;
  employerName?: string;

  // Custom values
  custom?: Record<string, string>;
}

/**
 * Result of template analysis
 */
export interface TemplateAnalysis {
  /** Placeholders found in the template */
  placeholders: PlaceholderInfo[];
  /** Whether all placeholders can be filled */
  canFullyHydrate: boolean;
  /** Missing values that would need user input */
  missingValues: PlaceholderType[];
  /** Template with placeholders highlighted */
  highlightedTemplate: string;
}

export interface PlaceholderInfo {
  /** The placeholder text (e.g., "[BSN]") */
  placeholder: string;
  /** The type of placeholder */
  type: PlaceholderType | 'custom';
  /** Position in template */
  position: number;
  /** Whether we have a value for this */
  hasValue: boolean;
}

/**
 * Result of re-hydration
 */
export interface RehydrationResult {
  /** The filled template */
  content: string;
  /** What was filled in (for audit trail) */
  filledPlaceholders: FilledPlaceholder[];
  /** Any placeholders that couldn't be filled */
  unfilledPlaceholders: string[];
  /** Whether fully hydrated */
  isComplete: boolean;
}

export interface FilledPlaceholder {
  placeholder: string;
  type: PlaceholderType | 'custom';
  /** Masked value for display (e.g., "***6789" for BSN) */
  maskedValue: string;
  /** Whether this is sensitive PII */
  isSensitive: boolean;
}

// ==================== Core Functions ====================

/**
 * Analyze a template for placeholders
 */
export function analyzeTemplate(template: string, piiValues: PIIValues): TemplateAnalysis {
  const placeholderRegex = /\[([A-Z_]+)\]/g;
  const placeholders: PlaceholderInfo[] = [];
  const missingValues: PlaceholderType[] = [];

  let match;
  while ((match = placeholderRegex.exec(template)) !== null) {
    const placeholderText = match[0];
    const placeholderKey = match[1];
    const type = getPlaceholderType(placeholderKey);
    const hasValue = hasValueForPlaceholder(type, piiValues);

    placeholders.push({
      placeholder: placeholderText,
      type,
      position: match.index,
      hasValue,
    });

    if (!hasValue && type !== 'custom') {
      missingValues.push(type as PlaceholderType);
    }
  }

  // Create highlighted version
  let highlightedTemplate = template;
  for (const p of placeholders) {
    const color = p.hasValue ? 'green' : 'red';
    highlightedTemplate = highlightedTemplate.replace(
      p.placeholder,
      `<span class="placeholder-${color}">${p.placeholder}</span>`
    );
  }

  return {
    placeholders,
    canFullyHydrate: missingValues.length === 0,
    missingValues: [...new Set(missingValues)] as PlaceholderType[],
    highlightedTemplate,
  };
}

/**
 * Re-hydrate a template with PII values
 */
export function rehydrateTemplate(template: string, piiValues: PIIValues): RehydrationResult {
  const filledPlaceholders: FilledPlaceholder[] = [];
  const unfilledPlaceholders: string[] = [];

  let result = template;

  // Process all placeholder types
  const replacements: Array<{ pattern: RegExp; getValue: () => string | undefined; type: PlaceholderType }> = [
    // Personal
    { pattern: /\[BSN\]/g, getValue: () => piiValues.bsn, type: 'BSN' },
    { pattern: /\[NAME\]/g, getValue: () => piiValues.name, type: 'NAME' },
    { pattern: /\[SURNAME\]/g, getValue: () => piiValues.surname, type: 'SURNAME' },
    { pattern: /\[FULL_NAME\]/g, getValue: () => combineFullName(piiValues), type: 'FULL_NAME' },
    { pattern: /\[DATE_OF_BIRTH\]/g, getValue: () => piiValues.dateOfBirth, type: 'DATE_OF_BIRTH' },

    // Contact
    { pattern: /\[EMAIL\]/g, getValue: () => piiValues.email, type: 'EMAIL' },
    { pattern: /\[PHONE\]/g, getValue: () => piiValues.phone, type: 'PHONE' },
    { pattern: /\[ADDRESS\]/g, getValue: () => piiValues.address, type: 'ADDRESS' },
    { pattern: /\[POSTCODE\]/g, getValue: () => piiValues.postcode, type: 'POSTCODE' },
    { pattern: /\[CITY\]/g, getValue: () => piiValues.city, type: 'CITY' },

    // Financial
    { pattern: /\[INCOME\]/g, getValue: () => piiValues.income, type: 'INCOME' },
    { pattern: /\[SALARY\]/g, getValue: () => piiValues.salary, type: 'SALARY' },
    { pattern: /\[IBAN\]/g, getValue: () => piiValues.iban, type: 'IBAN' },
    { pattern: /\[BANK_ACCOUNT\]/g, getValue: () => piiValues.iban, type: 'BANK_ACCOUNT' },

    // Tax
    { pattern: /\[TAX_NUMBER\]/g, getValue: () => piiValues.taxNumber || piiValues.bsn, type: 'TAX_NUMBER' },
    { pattern: /\[TAX_YEAR\]/g, getValue: () => piiValues.taxYear || getCurrentTaxYear(), type: 'TAX_YEAR' },

    // Third parties
    { pattern: /\[ACCOUNTANT_NAME\]/g, getValue: () => piiValues.accountantName, type: 'ACCOUNTANT_NAME' },
    { pattern: /\[ACCOUNTANT_EMAIL\]/g, getValue: () => piiValues.accountantEmail, type: 'ACCOUNTANT_EMAIL' },
    { pattern: /\[EMPLOYER_NAME\]/g, getValue: () => piiValues.employerName, type: 'EMPLOYER_NAME' },

    // Dynamic
    { pattern: /\[CURRENT_DATE\]/g, getValue: () => formatDate(new Date()), type: 'CURRENT_DATE' },
  ];

  for (const { pattern, getValue, type } of replacements) {
    const value = getValue();
    if (value && pattern.test(result)) {
      const placeholder = PLACEHOLDER_TYPES[type];
      result = result.replace(pattern, value);
      filledPlaceholders.push({
        placeholder,
        type,
        maskedValue: maskValue(value, type),
        isSensitive: isSensitivePII(type),
      });
    } else if (pattern.test(template)) {
      unfilledPlaceholders.push(PLACEHOLDER_TYPES[type]);
    }
  }

  // Handle custom placeholders
  if (piiValues.custom) {
    for (const [key, value] of Object.entries(piiValues.custom)) {
      const pattern = new RegExp(`\\[${key}\\]`, 'g');
      if (pattern.test(result)) {
        result = result.replace(pattern, value);
        filledPlaceholders.push({
          placeholder: `[${key}]`,
          type: 'custom',
          maskedValue: value.length > 10 ? value.slice(0, 10) + '...' : value,
          isSensitive: false,
        });
      }
    }
  }

  return {
    content: result,
    filledPlaceholders,
    unfilledPlaceholders: [...new Set(unfilledPlaceholders)],
    isComplete: unfilledPlaceholders.length === 0,
  };
}

/**
 * Generate a prompt for cloud LLM that instructs it to use placeholders
 */
export function buildTemplatePrompt(
  userRequest: string,
  templateType: 'email' | 'form' | 'document' | 'letter'
): string {
  const placeholderList = Object.values(PLACEHOLDER_TYPES).join(', ');

  return `Generate a ${templateType} based on the user's request.

IMPORTANT: Use these placeholders for any personal information:
${placeholderList}

Never include actual personal data - only use placeholders.
The user will fill in the real values locally.

User request: ${userRequest}

Generate the ${templateType} with appropriate placeholders:`;
}

// ==================== Helper Functions ====================

function getPlaceholderType(key: string): PlaceholderType | 'custom' {
  const typeMap: Record<string, PlaceholderType> = {
    BSN: 'BSN',
    NAME: 'NAME',
    SURNAME: 'SURNAME',
    FULL_NAME: 'FULL_NAME',
    DATE_OF_BIRTH: 'DATE_OF_BIRTH',
    EMAIL: 'EMAIL',
    PHONE: 'PHONE',
    ADDRESS: 'ADDRESS',
    POSTCODE: 'POSTCODE',
    CITY: 'CITY',
    INCOME: 'INCOME',
    SALARY: 'SALARY',
    IBAN: 'IBAN',
    BANK_ACCOUNT: 'BANK_ACCOUNT',
    TAX_NUMBER: 'TAX_NUMBER',
    TAX_YEAR: 'TAX_YEAR',
    ACCOUNTANT_NAME: 'ACCOUNTANT_NAME',
    ACCOUNTANT_EMAIL: 'ACCOUNTANT_EMAIL',
    EMPLOYER_NAME: 'EMPLOYER_NAME',
    CURRENT_DATE: 'CURRENT_DATE',
    DEADLINE_DATE: 'DEADLINE_DATE',
  };

  return typeMap[key] || 'custom';
}

function hasValueForPlaceholder(type: PlaceholderType | 'custom', piiValues: PIIValues): boolean {
  const valueMap: Record<PlaceholderType, keyof PIIValues | (() => boolean)> = {
    BSN: 'bsn',
    NAME: 'name',
    SURNAME: 'surname',
    FULL_NAME: () => !!(piiValues.name || piiValues.surname),
    DATE_OF_BIRTH: 'dateOfBirth',
    EMAIL: 'email',
    PHONE: 'phone',
    ADDRESS: 'address',
    POSTCODE: 'postcode',
    CITY: 'city',
    INCOME: 'income',
    SALARY: 'salary',
    IBAN: 'iban',
    BANK_ACCOUNT: 'iban',
    TAX_NUMBER: () => !!(piiValues.taxNumber || piiValues.bsn),
    TAX_YEAR: () => true, // Can always generate current year
    ACCOUNTANT_NAME: 'accountantName',
    ACCOUNTANT_EMAIL: 'accountantEmail',
    EMPLOYER_NAME: 'employerName',
    CURRENT_DATE: () => true, // Always available
    DEADLINE_DATE: () => false, // Needs to be provided
  };

  if (type === 'custom') return false;

  const check = valueMap[type];
  if (typeof check === 'function') return check();
  return !!piiValues[check as keyof PIIValues];
}

function combineFullName(piiValues: PIIValues): string | undefined {
  const parts = [piiValues.name, piiValues.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function maskValue(value: string, type: PlaceholderType): string {
  // Mask sensitive values for display
  switch (type) {
    case 'BSN':
      return value.length > 3 ? '***' + value.slice(-3) : '***';
    case 'IBAN':
    case 'BANK_ACCOUNT':
      return value.length > 4 ? '****' + value.slice(-4) : '****';
    case 'INCOME':
    case 'SALARY':
      return '€***';
    case 'PHONE':
      return value.length > 4 ? '****' + value.slice(-4) : '****';
    case 'EMAIL':
      const [local, domain] = value.split('@');
      return local.length > 2 ? local.slice(0, 2) + '***@' + domain : '***@' + domain;
    default:
      return value.length > 20 ? value.slice(0, 20) + '...' : value;
  }
}

function isSensitivePII(type: PlaceholderType): boolean {
  const sensitive: PlaceholderType[] = ['BSN', 'IBAN', 'BANK_ACCOUNT', 'INCOME', 'SALARY', 'TAX_NUMBER'];
  return sensitive.includes(type);
}

function getCurrentTaxYear(): string {
  const now = new Date();
  // Tax year is typically previous year if before April
  const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return year.toString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ==================== Template Examples ====================

/**
 * Example templates for common use cases
 */
export const TEMPLATE_EXAMPLES = {
  accountantEmail: `Subject: Vraag over belastingaangifte [TAX_YEAR]

Beste [ACCOUNTANT_NAME],

Mijn naam is [FULL_NAME] (BSN: [BSN]).

Ik heb een vraag over mijn belastingaangifte voor het jaar [TAX_YEAR].

[USER_QUESTION]

Kunt u mij hierbij helpen?

Met vriendelijke groet,
[FULL_NAME]
[EMAIL]
[PHONE]`,

  taxDocument: `BELASTINGGEGEVENS [TAX_YEAR]

Persoonlijke gegevens:
- Naam: [FULL_NAME]
- BSN: [BSN]
- Adres: [ADDRESS]
- Postcode/Plaats: [POSTCODE] [CITY]

Financiële gegevens:
- Jaarinkomen: [INCOME]
- IBAN: [IBAN]

Datum: [CURRENT_DATE]`,

  deductionRequest: `Verzoek om aftrekpost

Geachte heer/mevrouw,

Ondergetekende, [FULL_NAME], BSN [BSN], verzoekt hierbij om de volgende aftrekpost mee te nemen in de aangifte inkomstenbelasting [TAX_YEAR]:

[DEDUCTION_DETAILS]

Bijlagen:
- [ATTACHMENT_LIST]

Met vriendelijke groet,
[FULL_NAME]
[CURRENT_DATE]`,
};

export default {
  analyzeTemplate,
  rehydrateTemplate,
  buildTemplatePrompt,
  PLACEHOLDER_TYPES,
  TEMPLATE_EXAMPLES,
};

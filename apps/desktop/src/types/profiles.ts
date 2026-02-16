export interface Person {
    id: string;
    name: string;
    relationship: 'primary' | 'partner' | 'dependent' | 'other';
    household_id: string;
    created_at: string;
    updated_at: string;
}

export interface PIIValue {
    id: string;
    person_id: string;
    category: 'bsn' | 'name' | 'phone' | 'email' | 'address' | 'bank_account';
    value: string; // This will likely be masked when fetched for display
    source_document_id?: string;
}

export interface TaxConcept {
    term: string;
    definition: string;
    english_term?: string;
    why_needed: string;
    related_boxes: string[];
}

export interface RequirementAnalysis {
    concepts_needed: TaxConcept[];
    explanation: string;
    confidence: string;
}

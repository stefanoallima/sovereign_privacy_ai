use crate::db::Person;
use crate::entity_resolver::EntityResolver;
use crate::file_parsers;
use crate::profiles::ProfileRepository;
use crate::tax_knowledge::{TaxConceptInfo, TaxGroundingBlock, TaxKnowledgeBase};
use log::{error, info};
use std::sync::Mutex;
use tauri::State;

/// Parse a file (PDF or DOCX) and extract text
#[tauri::command]
pub fn parse_document(file_path: String) -> Result<ParsedDocumentDto, String> {
    info!("Parsing document: {}", file_path);

    let path = std::path::Path::new(&file_path);

    match file_parsers::parse_file(path) {
        Ok(doc) => {
            info!("Document parsed successfully");
            Ok(ParsedDocumentDto {
                filename: doc.filename,
                file_type: doc.file_type,
                text_content: doc.text_content,
                page_count: doc.structure.page_count,
                document_type: doc.structure.document_type,
            })
        }
        Err(e) => {
            error!("Failed to parse document: {}", e);
            Err(format!("Failed to parse document: {}", e))
        }
    }
}

/// Find matching persons by name
#[tauri::command]
pub fn find_person_matches(
    extracted_name: String,
    existing_persons: Vec<Person>,
) -> Result<Vec<EntityMatchDto>, String> {
    info!("Finding matches for name: {}", extracted_name);

    let matches = EntityResolver::find_matches(&extracted_name, &existing_persons);

    Ok(matches
        .into_iter()
        .map(|m| EntityMatchDto {
            person: m.person,
            score: m.score,
            confidence: m.confidence,
        })
        .collect())
}

/// Check if name should create a new person or match existing
#[tauri::command]
pub fn should_create_new_person_command(
    extracted_name: String,
    existing_persons: Vec<Person>,
) -> Result<ShouldCreateDecision, String> {
    let matches = EntityResolver::find_matches(&extracted_name, &existing_persons);
    let should_create = EntityResolver::should_create_new_person(&matches);

    Ok(ShouldCreateDecision {
        should_create_new: should_create,
        suggested_match: matches.first().map(|m| m.person.clone()),
        match_confidence: matches.first().map(|m| m.score),
    })
}

/// Mask PII value for display
#[tauri::command]
pub fn mask_pii_for_display(category: String, value: String) -> Result<String, String> {
    Ok(ProfileRepository::mask_pii_value(&category, &value))
}

fn concept_to_dto(c: TaxConceptInfo) -> TaxConceptDto {
    TaxConceptDto {
        term: c.term,
        definition: c.definition,
        english_term: c.english_term,
        why_needed: c.why_needed,
        related_boxes: c.related_boxes,
        applicable_year: c.applicable_year,
        box_number: c.box_number,
        evidence_required: c.evidence_required,
    }
}

/// Analyze accountant request and extract tax concepts
#[tauri::command]
pub fn analyze_accountant_request(
    request_text: String,
    state: State<'_, Mutex<TaxKnowledgeBase>>,
) -> Result<RequirementAnalysisDto, String> {
    match state.lock() {
        Ok(kb) => {
            info!("Analyzing accountant request");
            let analysis = kb.analyze_requirement(&request_text);

            Ok(RequirementAnalysisDto {
                concepts_needed: analysis
                    .concepts_needed
                    .into_iter()
                    .map(concept_to_dto)
                    .collect(),
                explanation: analysis.explanation,
                confidence: analysis.confidence,
                items: analysis
                    .items
                    .into_iter()
                    .map(|i| RequirementItemDto {
                        raw_text: i.raw_text,
                        concept_id: i.concept_id,
                        attachment_required: i.attachment_required,
                        field_required: i.field_required,
                        signature_required: i.signature_required,
                        count: i.count,
                    })
                    .collect(),
            })
        }
        Err(e) => {
            error!("Failed to acquire tax knowledge base: {}", e);
            Err(format!("Failed to analyze request: {}", e))
        }
    }
}

/// Get tax concept information
#[tauri::command]
pub fn get_tax_concept(
    term: String,
    state: State<'_, Mutex<TaxKnowledgeBase>>,
) -> Result<Option<TaxConceptDto>, String> {
    match state.lock() {
        Ok(kb) => {
            info!("Getting tax concept: {}", term);
            Ok(kb.get_concept(&term).map(concept_to_dto))
        }
        Err(e) => {
            error!("Failed to acquire tax knowledge base: {}", e);
            Err(format!("Failed to get concept: {}", e))
        }
    }
}

/// List all available tax concepts
#[tauri::command]
pub fn list_tax_concepts(
    state: State<'_, Mutex<TaxKnowledgeBase>>,
) -> Result<Vec<TaxConceptDto>, String> {
    match state.lock() {
        Ok(kb) => {
            info!("Listing all tax concepts");
            Ok(kb.list_all_concepts().into_iter().map(concept_to_dto).collect())
        }
        Err(e) => {
            error!("Failed to acquire tax knowledge base: {}", e);
            Err(format!("Failed to list concepts: {}", e))
        }
    }
}

/// Build a tax-grounding prelude for a chat message. Returns the augmented
/// message and the consulted concept ids so the UI can render a "Sources" strip.
#[tauri::command]
pub fn build_tax_grounding(
    message: String,
    persona_name: String,
    persona_system_prompt: String,
    state: State<'_, Mutex<TaxKnowledgeBase>>,
) -> Result<TaxGroundingBlockDto, String> {
    match state.lock() {
        Ok(kb) => {
            let block: TaxGroundingBlock =
                kb.build_grounding_block(&message, &persona_name, &persona_system_prompt);
            Ok(TaxGroundingBlockDto {
                augmented_message: block.augmented_message,
                consulted_concept_ids: block.consulted_concept_ids,
                concepts_used: block.concepts_used.into_iter().map(concept_to_dto).collect(),
                injected: block.injected,
            })
        }
        Err(e) => {
            error!("Failed to acquire tax knowledge base: {}", e);
            Err(format!("Failed to build tax grounding: {}", e))
        }
    }
}

// DTO types for Tauri serialization

#[derive(serde::Serialize)]
pub struct ParsedDocumentDto {
    pub filename: String,
    pub file_type: String,
    pub text_content: String,
    pub page_count: usize,
    pub document_type: Option<String>,
}

#[derive(serde::Serialize)]
pub struct EntityMatchDto {
    pub person: Person,
    pub score: f32,
    pub confidence: String,
}

#[derive(serde::Serialize)]
pub struct ShouldCreateDecision {
    pub should_create_new: bool,
    pub suggested_match: Option<Person>,
    pub match_confidence: Option<f32>,
}

#[derive(serde::Serialize)]
pub struct RequirementAnalysisDto {
    pub concepts_needed: Vec<TaxConceptDto>,
    pub explanation: String,
    pub confidence: String,
    pub items: Vec<RequirementItemDto>,
}

#[derive(serde::Serialize)]
pub struct RequirementItemDto {
    pub raw_text: String,
    pub concept_id: Option<String>,
    pub attachment_required: bool,
    pub field_required: bool,
    pub signature_required: bool,
    pub count: Option<u32>,
}

#[derive(serde::Serialize)]
pub struct TaxConceptDto {
    pub term: String,
    pub definition: String,
    pub english_term: Option<String>,
    pub why_needed: String,
    pub related_boxes: Vec<String>,
    pub applicable_year: Option<u32>,
    pub box_number: Option<String>,
    pub evidence_required: Vec<String>,
}

#[derive(serde::Serialize)]
pub struct TaxGroundingBlockDto {
    pub augmented_message: String,
    pub consulted_concept_ids: Vec<String>,
    pub concepts_used: Vec<TaxConceptDto>,
    pub injected: bool,
}

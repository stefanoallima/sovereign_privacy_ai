use crate::db::Person;
use crate::entity_resolver::EntityResolver;
use crate::file_parsers;
use crate::profiles::ProfileRepository;
use crate::tax_knowledge::TaxKnowledgeBase;
use log::{info, error};
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
                    .map(|c| TaxConceptDto {
                        term: c.term,
                        definition: c.definition,
                        english_term: c.english_term,
                        why_needed: c.why_needed,
                        related_boxes: c.related_boxes,
                    })
                    .collect(),
                explanation: analysis.explanation,
                confidence: analysis.confidence,
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
            Ok(kb.get_concept(&term).map(|c| TaxConceptDto {
                term: c.term,
                definition: c.definition,
                english_term: c.english_term,
                why_needed: c.why_needed,
                related_boxes: c.related_boxes,
            }))
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
            Ok(kb
                .list_all_concepts()
                .into_iter()
                .map(|c| TaxConceptDto {
                    term: c.term,
                    definition: c.definition,
                    english_term: c.english_term,
                    why_needed: c.why_needed,
                    related_boxes: c.related_boxes,
                })
                .collect())
        }
        Err(e) => {
            error!("Failed to acquire tax knowledge base: {}", e);
            Err(format!("Failed to list concepts: {}", e))
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
}

#[derive(serde::Serialize)]
pub struct TaxConceptDto {
    pub term: String,
    pub definition: String,
    pub english_term: Option<String>,
    pub why_needed: String,
    pub related_boxes: Vec<String>,
}

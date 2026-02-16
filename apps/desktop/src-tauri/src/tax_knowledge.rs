use log::info;
use std::collections::HashMap;

/// Dutch tax concepts and their explanations
pub struct TaxKnowledgeBase {
    concepts: HashMap<String, TaxConceptInfo>,
}

#[derive(Debug, Clone)]
pub struct TaxConceptInfo {
    pub term: String,
    pub definition: String,
    pub english_term: Option<String>,
    pub why_needed: String,
    pub related_boxes: Vec<String>, // IND box numbers (Box 1, Box 3, etc.)
}

impl TaxKnowledgeBase {
    /// Create a new tax knowledge base with common Dutch tax concepts
    pub fn new() -> Self {
        let mut concepts = HashMap::new();

        // Common Dutch tax concepts
        let tax_concepts = vec![
            (
                "bsn",
                TaxConceptInfo {
                    term: "BSN".to_string(),
                    definition: "Burgerservicenummer - Dutch citizen service number (9 digits)".to_string(),
                    english_term: Some("Citizen Service Number".to_string()),
                    why_needed: "Required for all tax filings and identification purposes".to_string(),
                    related_boxes: vec!["Identification".to_string()],
                },
            ),
            (
                "jaaropgaaf",
                TaxConceptInfo {
                    term: "Jaaropgaaf".to_string(),
                    definition: "Annual income statement from employer showing salary, tax withheld, and deductions".to_string(),
                    english_term: Some("Annual Income Statement".to_string()),
                    why_needed: "Proof of employment income and tax already paid".to_string(),
                    related_boxes: vec!["Box 1".to_string()],
                },
            ),
            (
                "woz",
                TaxConceptInfo {
                    term: "WOZ-waarde".to_string(),
                    definition: "Waarde Onroerende Zaken - Assessed market value of real estate property".to_string(),
                    english_term: Some("Real Estate Value".to_string()),
                    why_needed: "Used for Box 3 (wealth tax) calculations and property tax assessments".to_string(),
                    related_boxes: vec!["Box 3".to_string()],
                },
            ),
            (
                "inkomstenbelasting",
                TaxConceptInfo {
                    term: "Inkomstenbelasting".to_string(),
                    definition: "Income tax - tax on wages, income, and benefits".to_string(),
                    english_term: Some("Income Tax".to_string()),
                    why_needed: "Main tax on personal income".to_string(),
                    related_boxes: vec!["Box 1".to_string(), "Box 2".to_string()],
                },
            ),
            (
                "dividend",
                TaxConceptInfo {
                    term: "Dividend".to_string(),
                    definition: "Distribution of profit from shares or investment partnerships".to_string(),
                    english_term: Some("Dividend Payment".to_string()),
                    why_needed: "Must be reported as income if you own shares".to_string(),
                    related_boxes: vec!["Box 2".to_string(), "Box 4".to_string()],
                },
            ),
            (
                "loonheffing",
                TaxConceptInfo {
                    term: "Loonheffing".to_string(),
                    definition: "Wage tax withheld by employer (part of payroll taxes)".to_string(),
                    english_term: Some("Wage Tax".to_string()),
                    why_needed: "Tax already paid on salary that reduces final tax due".to_string(),
                    related_boxes: vec!["Box 1".to_string()],
                },
            ),
            (
                "zorgtoeslag",
                TaxConceptInfo {
                    term: "Zorgtoeslag".to_string(),
                    definition: "Healthcare allowance/subsidy from government for health insurance".to_string(),
                    english_term: Some("Healthcare Allowance".to_string()),
                    why_needed: "Income-dependent benefit that must be reconciled with actual income".to_string(),
                    related_boxes: vec!["Benefits".to_string()],
                },
            ),
            (
                "fiscale-partner",
                TaxConceptInfo {
                    term: "Fiscale partner".to_string(),
                    definition: "Spouse or registered partner recognized for joint tax filing".to_string(),
                    english_term: Some("Tax Partner".to_string()),
                    why_needed: "Affects tax brackets and joint filing options".to_string(),
                    related_boxes: vec!["Filing Status".to_string()],
                },
            ),
            (
                "box-1",
                TaxConceptInfo {
                    term: "Box 1 - Loon".to_string(),
                    definition: "Wages and salaries from employment".to_string(),
                    english_term: Some("Box 1 - Wages".to_string()),
                    why_needed: "Primary income source for most employees".to_string(),
                    related_boxes: vec!["Box 1".to_string()],
                },
            ),
            (
                "box-3",
                TaxConceptInfo {
                    term: "Box 3 - Vermogen".to_string(),
                    definition: "Wealth tax on savings and investments (not income-producing)".to_string(),
                    english_term: Some("Box 3 - Wealth".to_string()),
                    why_needed: "Tax on net assets like savings, real estate value".to_string(),
                    related_boxes: vec!["Box 3".to_string()],
                },
            ),
        ];

        for (key, concept) in tax_concepts {
            concepts.insert(key.to_string(), concept);
        }

        TaxKnowledgeBase { concepts }
    }

    /// Get a tax concept by term
    pub fn get_concept(&self, term: &str) -> Option<TaxConceptInfo> {
        let term_lower = term.to_lowercase();

        // Try exact match first
        if let Some(concept) = self.concepts.get(&term_lower) {
            return Some(concept.clone());
        }

        // Try partial match in definitions
        for concept in self.concepts.values() {
            if concept.term.to_lowercase().contains(&term_lower)
                || concept
                    .definition
                    .to_lowercase()
                    .contains(&term_lower)
            {
                return Some(concept.clone());
            }
        }

        None
    }

    /// Extract tax-related keywords from text
    pub fn extract_tax_keywords(&self, text: &str) -> Vec<String> {
        let text_lower = text.to_lowercase();
        let mut keywords = Vec::new();

        for concept_key in self.concepts.keys() {
            if text_lower.contains(&concept_key.replace("-", " ")) {
                keywords.push(concept_key.clone());
            }
        }

        info!("Extracted {} tax keywords from text", keywords.len());

        keywords
    }

    /// Analyze accountant request and extract required tax concepts
    pub fn analyze_requirement(
        &self,
        requirement_text: &str,
    ) -> RequirementAnalysis {
        info!("Analyzing requirement: {}", requirement_text);

        let keywords = self.extract_tax_keywords(requirement_text);
        let mut concepts_needed = Vec::new();

        for keyword in keywords {
            if let Some(concept) = self.get_concept(&keyword) {
                concepts_needed.push(concept);
            }
        }

        let is_empty = concepts_needed.is_empty();

        let explanation = if is_empty {
            "Unable to identify specific tax concepts. Please provide more details.".to_string()
        } else {
            format!(
                "The accountant is asking for {} specific tax-related item(s): {}",
                concepts_needed.len(),
                concepts_needed
                    .iter()
                    .map(|c| &c.term)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };

        let confidence = if is_empty {
            "low".to_string()
        } else {
            "high".to_string()
        };

        RequirementAnalysis {
            concepts_needed,
            explanation,
            confidence,
        }
    }

    /// Get all available tax concepts
    pub fn list_all_concepts(&self) -> Vec<TaxConceptInfo> {
        self.concepts
            .values()
            .cloned()
            .collect()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RequirementAnalysis {
    pub concepts_needed: Vec<TaxConceptInfo>,
    pub explanation: String,
    pub confidence: String,
}


impl serde::Serialize for TaxConceptInfo {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("TaxConceptInfo", 5)?;
        state.serialize_field("term", &self.term)?;
        state.serialize_field("definition", &self.definition)?;
        state.serialize_field("english_term", &self.english_term)?;
        state.serialize_field("why_needed", &self.why_needed)?;
        state.serialize_field("related_boxes", &self.related_boxes)?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knowledge_base_creation() {
        let kb = TaxKnowledgeBase::new();
        assert!(!kb.concepts.is_empty());
    }

    #[test]
    fn test_get_concept() {
        let kb = TaxKnowledgeBase::new();
        let concept = kb.get_concept("bsn");

        assert!(concept.is_some());
        assert_eq!(concept.unwrap().term, "BSN");
    }

    #[test]
    fn test_extract_keywords() {
        let kb = TaxKnowledgeBase::new();
        let keywords = kb.extract_tax_keywords("My Jaaropgaaf shows dividend income");

        assert!(keywords.contains(&"jaaropgaaf".to_string()));
        assert!(keywords.contains(&"dividend".to_string()));
    }

    #[test]
    fn test_analyze_requirement() {
        let kb = TaxKnowledgeBase::new();
        let analysis = kb.analyze_requirement("Please provide your WOZ-waarde and dividend overview");

        assert!(!analysis.concepts_needed.is_empty());
        assert_eq!(analysis.confidence, "high");
    }
}

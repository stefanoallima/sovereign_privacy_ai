use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxConceptInfo {
    pub term: String,
    pub definition: String,
    #[serde(default)]
    pub english_term: Option<String>,
    pub why_needed: String,
    #[serde(default)]
    pub related_boxes: Vec<String>,
    #[serde(default)]
    pub applicable_year: Option<u32>,
    #[serde(default)]
    pub box_number: Option<String>,
    #[serde(default)]
    pub evidence_required: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaxGroundingBlock {
    pub augmented_message: String,
    pub consulted_concept_ids: Vec<String>,
    pub concepts_used: Vec<TaxConceptInfo>,
    pub injected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct RequirementItem {
    pub raw_text: String,
    pub concept_id: Option<String>,
    pub attachment_required: bool,
    pub field_required: bool,
    pub signature_required: bool,
    pub count: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RequirementAnalysis {
    pub concepts_needed: Vec<TaxConceptInfo>,
    pub explanation: String,
    pub confidence: String,
    pub items: Vec<RequirementItem>,
}

pub struct TaxKnowledgeBase {
    concepts: HashMap<String, TaxConceptInfo>,
}

impl TaxKnowledgeBase {
    pub fn new() -> Self {
        let mut concepts: HashMap<String, TaxConceptInfo> = HashMap::new();
        for (key, info) in embedded_catalog() {
            concepts.insert(key.to_string(), info);
        }
        TaxKnowledgeBase { concepts }
    }

    pub fn load_from_disk(path: &Path) -> Result<Self, String> {
        let bytes = std::fs::read(path)
            .map_err(|e| format!("read {}: {}", path.display(), e))?;
        let parsed: HashMap<String, TaxConceptInfo> = serde_json::from_slice(&bytes)
            .map_err(|e| format!("parse {}: {}", path.display(), e))?;
        if parsed.is_empty() {
            return Err(format!("catalog at {} is empty", path.display()));
        }
        info!(
            "Loaded {} tax concepts from {}",
            parsed.len(),
            path.display()
        );
        Ok(TaxKnowledgeBase { concepts: parsed })
    }

    pub fn new_with_overlay(path: &Path) -> Self {
        match Self::load_from_disk(path) {
            Ok(kb) => kb,
            Err(e) => {
                warn!("Tax catalog overlay failed ({}); using embedded", e);
                Self::new()
            }
        }
    }

    pub fn get_concept(&self, term: &str) -> Option<TaxConceptInfo> {
        let term_lower = term.to_lowercase();
        if let Some(c) = self.concepts.get(&term_lower) {
            return Some(c.clone());
        }
        for c in self.concepts.values() {
            if c.term.to_lowercase().contains(&term_lower)
                || c.definition.to_lowercase().contains(&term_lower)
            {
                return Some(c.clone());
            }
        }
        None
    }

    pub fn extract_tax_keywords(&self, text: &str) -> Vec<String> {
        let text_lower = text.to_lowercase();
        let mut hits: Vec<String> = Vec::new();
        for (key, concept) in &self.concepts {
            let key_words = key.replace('-', " ");
            let term_lower = concept.term.to_lowercase();
            if text_lower.contains(&key_words)
                || text_lower.contains(key)
                || text_lower.contains(&term_lower)
            {
                if !hits.contains(key) {
                    hits.push(key.clone());
                }
            }
        }
        hits.sort();
        info!("Extracted {} tax keywords from text", hits.len());
        hits
    }

    pub fn build_grounding_block(
        &self,
        message: &str,
        persona_name: &str,
        persona_system_prompt: &str,
    ) -> TaxGroundingBlock {
        if !persona_is_tax_tagged(persona_name, persona_system_prompt) {
            return TaxGroundingBlock {
                augmented_message: message.to_string(),
                consulted_concept_ids: Vec::new(),
                concepts_used: Vec::new(),
                injected: false,
            };
        }
        let mut ids = self.extract_tax_keywords(message);
        const MAX_CONCEPTS: usize = 6;
        if ids.len() > MAX_CONCEPTS {
            ids.truncate(MAX_CONCEPTS);
        }
        if ids.is_empty() {
            return TaxGroundingBlock {
                augmented_message: message.to_string(),
                consulted_concept_ids: Vec::new(),
                concepts_used: Vec::new(),
                injected: false,
            };
        }
        let concepts: Vec<TaxConceptInfo> = ids
            .iter()
            .filter_map(|id| self.concepts.get(id).cloned())
            .collect();
        let mut block = String::from("## Tax Concepts Available\n\n");
        for c in &concepts {
            let year = c
                .applicable_year
                .map(|y| format!(" ({})", y))
                .unwrap_or_default();
            let box_str = c.box_number.clone().unwrap_or_else(|| "-".to_string());
            block.push_str(&format!(
                "- **{}**{} [{}]: {}\n  _Why:_ {}",
                c.term, year, box_str, c.definition, c.why_needed
            ));
            if !c.evidence_required.is_empty() {
                block.push_str(&format!(
                    "\n  _Evidence:_ {}",
                    c.evidence_required.join(", ")
                ));
            }
            block.push('\n');
        }
        block.push_str("\nGround your reply in these concepts. Do NOT invent monetary figures; cite values only from the user's profile or attached documents.\n\n---\n\n");
        block.push_str(message);
        TaxGroundingBlock {
            augmented_message: block,
            consulted_concept_ids: ids,
            concepts_used: concepts,
            injected: true,
        }
    }

    pub fn analyze_requirement(&self, requirement_text: &str) -> RequirementAnalysis {
        info!("Analyzing requirement: {}", requirement_text);
        let keyword_ids = self.extract_tax_keywords(requirement_text);
        let mut concepts_needed: Vec<TaxConceptInfo> = Vec::new();
        for id in &keyword_ids {
            if let Some(c) = self.concepts.get(id) {
                concepts_needed.push(c.clone());
            }
        }
        let items = itemize_requirement(requirement_text, &keyword_ids);
        let is_empty = concepts_needed.is_empty() && items.is_empty();
        let explanation = if is_empty {
            "Unable to identify specific tax concepts. Please provide more details.".to_string()
        } else if concepts_needed.is_empty() {
            format!(
                "Identified {} requested item(s) but no specific tax concept could be matched.",
                items.len()
            )
        } else {
            format!(
                "The accountant is asking for {} specific tax-related item(s): {}",
                concepts_needed.len(),
                concepts_needed
                    .iter()
                    .map(|c| c.term.clone())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };
        let confidence = if is_empty {
            "low".to_string()
        } else if concepts_needed.is_empty() {
            "medium".to_string()
        } else {
            "high".to_string()
        };
        RequirementAnalysis {
            concepts_needed,
            explanation,
            confidence,
            items,
        }
    }

    pub fn list_all_concepts(&self) -> Vec<TaxConceptInfo> {
        self.concepts.values().cloned().collect()
    }

    pub fn list_concept_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.concepts.keys().cloned().collect();
        ids.sort();
        ids
    }
}

pub fn persona_is_tax_tagged(name: &str, system_prompt: &str) -> bool {
    let n = name.to_lowercase();
    let p = system_prompt.to_lowercase();
    const NEEDLES: [&str; 8] = [
        "tax",
        "belasting",
        "fiscaal",
        "fiscale",
        "accountant",
        "aangifte",
        "btw",
        "belastingdienst",
    ];
    NEEDLES.iter().any(|k| n.contains(k) || p.contains(k))
}

fn itemize_requirement(text: &str, matched_ids: &[String]) -> Vec<RequirementItem> {
    let lower = text.to_lowercase();
    let mut items: Vec<RequirementItem> = Vec::new();

    let attachment_keywords = [
        "bijlage",
        "bijlagen",
        "attachment",
        "attachments",
        "document",
        "documenten",
        "documents",
    ];
    let signature_keywords = [
        "handtekening",
        "signature",
        "ondertekenen",
        "signed",
        "ondertekend",
    ];
    let field_keywords = [
        "bsn",
        "iban",
        "bedrag",
        "amount",
        "income",
        "inkomen",
        "salaris",
        "geboortedatum",
        "address",
        "adres",
    ];

    let attachment_found = attachment_keywords.iter().any(|k| lower.contains(k));
    let signature_found = signature_keywords.iter().any(|k| lower.contains(k));
    let field_found = field_keywords.iter().any(|k| lower.contains(k));

    if attachment_found {
        let count = parse_count_phrase(&lower, &attachment_keywords);
        items.push(RequirementItem {
            raw_text: extract_window(text, &attachment_keywords)
                .unwrap_or_else(|| text.to_string()),
            concept_id: matched_ids.first().cloned(),
            attachment_required: true,
            field_required: false,
            signature_required: false,
            count,
        });
    }
    if signature_found {
        items.push(RequirementItem {
            raw_text: extract_window(text, &signature_keywords)
                .unwrap_or_else(|| text.to_string()),
            concept_id: None,
            attachment_required: false,
            field_required: false,
            signature_required: true,
            count: None,
        });
    }
    if field_found {
        items.push(RequirementItem {
            raw_text: extract_window(text, &field_keywords).unwrap_or_else(|| text.to_string()),
            concept_id: matched_ids
                .iter()
                .find(|id| field_keywords.iter().any(|f| id.contains(f)))
                .cloned()
                .or_else(|| matched_ids.first().cloned()),
            attachment_required: false,
            field_required: true,
            signature_required: false,
            count: None,
        });
    }
    for id in matched_ids {
        if !items
            .iter()
            .any(|it| it.concept_id.as_deref() == Some(id.as_str()))
        {
            items.push(RequirementItem {
                raw_text: id.clone(),
                concept_id: Some(id.clone()),
                attachment_required: false,
                field_required: true,
                signature_required: false,
                count: None,
            });
        }
    }
    items
}

fn parse_count_phrase(text: &str, anchors: &[&str]) -> Option<u32> {
    let words = [
        ("een", 1u32), ("één", 1), ("one", 1),
        ("twee", 2), ("two", 2),
        ("drie", 3), ("three", 3),
        ("vier", 4), ("four", 4),
        ("vijf", 5), ("five", 5),
        ("zes", 6), ("six", 6),
        ("zeven", 7), ("seven", 7),
        ("acht", 8), ("eight", 8),
        ("negen", 9), ("nine", 9),
        ("tien", 10), ("ten", 10),
    ];
    let lower = text.to_lowercase();
    for anchor in anchors {
        if let Some(pos) = lower.find(anchor) {
            let prefix = &lower[..pos];
            if let Some(num) = prefix
                .split(|c: char| !c.is_ascii_digit())
                .filter(|s| !s.is_empty())
                .last()
                .and_then(|s| s.parse::<u32>().ok())
            {
                return Some(num);
            }
            for (word, val) in &words {
                if prefix.contains(word) {
                    return Some(*val);
                }
            }
        }
    }
    None
}

fn extract_window(text: &str, anchors: &[&str]) -> Option<String> {
    let lower = text.to_lowercase();
    for anchor in anchors {
        if let Some(pos) = lower.find(anchor) {
            let start = pos.saturating_sub(40);
            let end = (pos + anchor.len() + 40).min(text.len());
            return Some(text[start..end].trim().to_string());
        }
    }
    None
}

fn embedded_catalog() -> Vec<(&'static str, TaxConceptInfo)> {
    vec![
        ("bsn", TaxConceptInfo {
            term: "BSN".into(),
            definition: "Burgerservicenummer - Dutch citizen service number (9 digits)".into(),
            english_term: Some("Citizen Service Number".into()),
            why_needed: "Required for all tax filings and identification purposes".into(),
            related_boxes: vec!["Identification".into()],
            applicable_year: None,
            box_number: Some("Identification".into()),
            evidence_required: vec!["Passport / ID card".into()],
        }),
        ("jaaropgaaf", TaxConceptInfo {
            term: "Jaaropgaaf".into(),
            definition: "Annual income statement from employer showing salary, tax withheld, and deductions".into(),
            english_term: Some("Annual Income Statement".into()),
            why_needed: "Proof of employment income and tax already paid".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Jaaropgaaf PDF from employer".into()],
        }),
        ("woz", TaxConceptInfo {
            term: "WOZ-waarde".into(),
            definition: "Waarde Onroerende Zaken - assessed market value of real estate property".into(),
            english_term: Some("Real Estate Value".into()),
            why_needed: "Used for Box 1 (eigenwoningforfait) and municipal property tax".into(),
            related_boxes: vec!["Box 1".into(), "Box 3".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["WOZ-beschikking from municipality".into()],
        }),
        ("inkomstenbelasting", TaxConceptInfo {
            term: "Inkomstenbelasting".into(),
            definition: "Income tax - tax on wages, business income, and benefits".into(),
            english_term: Some("Income Tax".into()),
            why_needed: "Main tax on personal income".into(),
            related_boxes: vec!["Box 1".into(), "Box 2".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Aangifte form".into()],
        }),
        ("dividend", TaxConceptInfo {
            term: "Dividend".into(),
            definition: "Distribution of profit from shares or investment partnerships".into(),
            english_term: Some("Dividend Payment".into()),
            why_needed: "Reported as Box 2 if substantial interest, otherwise as Box 3 wealth".into(),
            related_boxes: vec!["Box 2".into(), "Box 3".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 2".into()),
            evidence_required: vec!["Broker statement".into(), "Dividend tax certificate".into()],
        }),
        ("loonheffing", TaxConceptInfo {
            term: "Loonheffing".into(),
            definition: "Wage tax withheld by employer (part of payroll taxes)".into(),
            english_term: Some("Wage Tax".into()),
            why_needed: "Tax already paid on salary that reduces final tax due".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Jaaropgaaf".into()],
        }),
        ("zorgtoeslag", TaxConceptInfo {
            term: "Zorgtoeslag".into(),
            definition: "Healthcare allowance - income-tested subsidy for health insurance".into(),
            english_term: Some("Healthcare Allowance".into()),
            why_needed: "Reconciled annually against actual taxable income".into(),
            related_boxes: vec!["Benefits".into()],
            applicable_year: Some(2025),
            box_number: Some("Benefits".into()),
            evidence_required: vec!["Toeslagen account statement".into()],
        }),
        ("fiscale-partner", TaxConceptInfo {
            term: "Fiscale partner".into(),
            definition: "Spouse or registered partner recognized for joint tax filing".into(),
            english_term: Some("Tax Partner".into()),
            why_needed: "Affects deduction allocation and joint filing options".into(),
            related_boxes: vec!["Filing Status".into()],
            applicable_year: None,
            box_number: Some("Filing Status".into()),
            evidence_required: vec!["BSN of partner".into(), "Marriage / partnership certificate".into()],
        }),
        ("box-1", TaxConceptInfo {
            term: "Box 1 - Werk en woning".into(),
            definition: "Income from employment, self-employment, and primary residence".into(),
            english_term: Some("Box 1 - Work & Home".into()),
            why_needed: "Primary income source for most filers".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Jaaropgaaf or P&L statement".into()],
        }),
        ("box-2", TaxConceptInfo {
            term: "Box 2 - Aanmerkelijk belang".into(),
            definition: "Income from a substantial interest (>=5%) in a company".into(),
            english_term: Some("Box 2 - Substantial Interest".into()),
            why_needed: "Captures DGA dividend income and capital gains".into(),
            related_boxes: vec!["Box 2".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 2".into()),
            evidence_required: vec!["Shareholder register".into(), "Dividend statements".into()],
        }),
        ("box-3", TaxConceptInfo {
            term: "Box 3 - Sparen en beleggen".into(),
            definition: "Wealth tax on savings and investments above the threshold".into(),
            english_term: Some("Box 3 - Savings & Investments".into()),
            why_needed: "Tax on net assets like savings, second-home value, securities".into(),
            related_boxes: vec!["Box 3".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 3".into()),
            evidence_required: vec!["Bank statements as of 1 Jan".into(), "Broker statements".into()],
        }),
        ("box-4", TaxConceptInfo {
            term: "Box 4 - Other income (legacy reference)".into(),
            definition: "Catch-all category in older guidance; modern aangifte uses Box 1/2/3".into(),
            english_term: Some("Box 4 - Other".into()),
            why_needed: "Disambiguates references in older accountant correspondence".into(),
            related_boxes: vec!["Box 4".into()],
            applicable_year: None,
            box_number: Some("Box 4".into()),
            evidence_required: vec!["Source document referenced".into()],
        }),
        ("hypotheekrenteaftrek", TaxConceptInfo {
            term: "Hypotheekrenteaftrek".into(),
            definition: "Mortgage interest deduction on primary residence (eigen woning)".into(),
            english_term: Some("Mortgage Interest Deduction".into()),
            why_needed: "Reduces taxable Box 1 income; capped and phased per year".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Annual mortgage statement (jaaropgave hypotheek)".into()],
        }),
        ("eigenwoningforfait", TaxConceptInfo {
            term: "Eigenwoningforfait".into(),
            definition: "Imputed income added to Box 1 for owning a primary residence, computed as a percentage of WOZ value".into(),
            english_term: Some("Imputed Home-Owner Income".into()),
            why_needed: "Offsets the mortgage interest deduction".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["WOZ-beschikking".into()],
        }),
        ("eigen-woning", TaxConceptInfo {
            term: "Eigen woning".into(),
            definition: "Primary residence under the eigenwoningregeling - qualifies for hypotheekrenteaftrek and eigenwoningforfait".into(),
            english_term: Some("Primary Residence".into()),
            why_needed: "Determines whether mortgage interest is deductible in Box 1".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Address registration (BRP)".into()],
        }),
        ("zelfstandigenaftrek", TaxConceptInfo {
            term: "Zelfstandigenaftrek".into(),
            definition: "Self-employed deduction for entrepreneurs meeting urencriterium".into(),
            english_term: Some("Self-Employed Deduction".into()),
            why_needed: "Reduces taxable profit for ZZP'ers and IB-ondernemers".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Hours administration".into(), "KvK extract".into()],
        }),
        ("oudedagsreserve", TaxConceptInfo {
            term: "Fiscale Oudedagsreserve (FOR)".into(),
            definition: "Self-employed pension reserve - phased out from 2023; existing balances remain".into(),
            english_term: Some("Self-Employed Retirement Reserve".into()),
            why_needed: "Affects deferred tax and pension planning for entrepreneurs".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["FOR balance from prior aangifte".into()],
        }),
        ("mkb-winstvrijstelling", TaxConceptInfo {
            term: "MKB-winstvrijstelling".into(),
            definition: "Profit exemption for SME entrepreneurs - applied after entrepreneur deductions".into(),
            english_term: Some("SME Profit Exemption".into()),
            why_needed: "Lowers taxable profit by a fixed percentage".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["P&L statement".into()],
        }),
        ("kor", TaxConceptInfo {
            term: "KOR (Kleineondernemersregeling)".into(),
            definition: "Small business VAT scheme - exempts entrepreneurs with turnover below 20k EUR from charging BTW".into(),
            english_term: Some("Small Business VAT Scheme".into()),
            why_needed: "Determines whether BTW must be filed and charged".into(),
            related_boxes: vec!["BTW".into()],
            applicable_year: Some(2025),
            box_number: Some("BTW".into()),
            evidence_required: vec!["KOR registration confirmation".into(), "Annual turnover".into()],
        }),
        ("urencriterium", TaxConceptInfo {
            term: "Urencriterium".into(),
            definition: "Hours criterion: >=1,225 hours/year on entrepreneurial activity to qualify for entrepreneur deductions".into(),
            english_term: Some("Hours Criterion".into()),
            why_needed: "Gates access to zelfstandigenaftrek, startersaftrek, MKB-winstvrijstelling".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Hours administration / urenregistratie".into()],
        }),
        ("startersaftrek", TaxConceptInfo {
            term: "Startersaftrek".into(),
            definition: "Starter's deduction - extra deduction in first 3 of 5 years for new entrepreneurs".into(),
            english_term: Some("Starter's Deduction".into()),
            why_needed: "Stacks with zelfstandigenaftrek for early-stage entrepreneurs".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["KvK start date".into()],
        }),
        ("kleinschaligheidsinvesteringsaftrek", TaxConceptInfo {
            term: "Kleinschaligheidsinvesteringsaftrek (KIA)".into(),
            definition: "Small-scale investment deduction for business assets purchased in the year".into(),
            english_term: Some("Small-Scale Investment Deduction".into()),
            why_needed: "Reduces taxable profit when investing in qualifying business assets".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Invoices for qualifying investments".into()],
        }),
        ("kindgebonden-budget", TaxConceptInfo {
            term: "Kindgebonden budget".into(),
            definition: "Income-tested child benefit supplement on top of kinderbijslag".into(),
            english_term: Some("Child-Related Budget".into()),
            why_needed: "Income-dependent benefit reconciled annually".into(),
            related_boxes: vec!["Benefits".into()],
            applicable_year: Some(2025),
            box_number: Some("Benefits".into()),
            evidence_required: vec!["Toeslagen account".into()],
        }),
        ("huurtoeslag", TaxConceptInfo {
            term: "Huurtoeslag".into(),
            definition: "Rent allowance - income- and rent-tested housing subsidy".into(),
            english_term: Some("Rent Allowance".into()),
            why_needed: "Income-tested benefit reconciled annually".into(),
            related_boxes: vec!["Benefits".into()],
            applicable_year: Some(2025),
            box_number: Some("Benefits".into()),
            evidence_required: vec!["Rent contract".into(), "Income statement".into()],
        }),
        ("kinderopvangtoeslag", TaxConceptInfo {
            term: "Kinderopvangtoeslag".into(),
            definition: "Childcare allowance - income-tested subsidy for registered daycare".into(),
            english_term: Some("Childcare Allowance".into()),
            why_needed: "Reconciled annually; over-claim leads to repayment".into(),
            related_boxes: vec!["Benefits".into()],
            applicable_year: Some(2025),
            box_number: Some("Benefits".into()),
            evidence_required: vec!["Daycare invoices".into(), "LRK number of provider".into()],
        }),
        ("aftrekposten", TaxConceptInfo {
            term: "Aftrekposten".into(),
            definition: "Generic term for deductible items in the aangifte (giften, alimony, study costs pre-2022)".into(),
            english_term: Some("Deductible Items".into()),
            why_needed: "Aggregate category for itemized deductions".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Receipts and proof per deduction".into()],
        }),
        ("voorlopige-aanslag", TaxConceptInfo {
            term: "Voorlopige aanslag".into(),
            definition: "Provisional tax assessment - paid or refunded in installments during the tax year".into(),
            english_term: Some("Provisional Tax Assessment".into()),
            why_needed: "Reconciled with the definitive aanslag after aangifte".into(),
            related_boxes: vec!["Filing".into()],
            applicable_year: Some(2025),
            box_number: Some("Filing".into()),
            evidence_required: vec!["Voorlopige aanslag letter".into()],
        }),
        ("vermogensbelasting", TaxConceptInfo {
            term: "Vermogensbelasting".into(),
            definition: "Wealth tax - historical name for what is now Box 3 income from savings & investments".into(),
            english_term: Some("Wealth Tax".into()),
            why_needed: "Disambiguates references to Box 3 in legacy correspondence".into(),
            related_boxes: vec!["Box 3".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 3".into()),
            evidence_required: vec!["Box 3 asset statement".into()],
        }),
        ("arbeidskorting", TaxConceptInfo {
            term: "Arbeidskorting".into(),
            definition: "Labor tax credit applied to working income, phasing in/out by income level".into(),
            english_term: Some("Labor Tax Credit".into()),
            why_needed: "Reduces tax owed on Box 1 work income".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Jaaropgaaf".into()],
        }),
        ("algemene-heffingskorting", TaxConceptInfo {
            term: "Algemene heffingskorting".into(),
            definition: "General tax credit applied to taxable income, phasing out above a threshold".into(),
            english_term: Some("General Tax Credit".into()),
            why_needed: "Reduces tax due for everyone with taxable income".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["Aangifte form".into()],
        }),
        ("ondernemersaftrek", TaxConceptInfo {
            term: "Ondernemersaftrek".into(),
            definition: "Bundle of entrepreneur deductions including zelfstandigenaftrek, startersaftrek, meewerkaftrek, FOR".into(),
            english_term: Some("Entrepreneur Deductions".into()),
            why_needed: "Reduces taxable profit for self-employed taxpayers".into(),
            related_boxes: vec!["Box 1".into()],
            applicable_year: Some(2025),
            box_number: Some("Box 1".into()),
            evidence_required: vec!["KvK extract".into(), "Hours administration".into()],
        }),
        ("btw", TaxConceptInfo {
            term: "BTW (Omzetbelasting)".into(),
            definition: "Value-added tax on sales and purchases - quarterly or annual aangifte".into(),
            english_term: Some("Value-Added Tax".into()),
            why_needed: "Required for entrepreneurs not under KOR; affects invoicing and bookkeeping".into(),
            related_boxes: vec!["BTW".into()],
            applicable_year: Some(2025),
            box_number: Some("BTW".into()),
            evidence_required: vec!["Sales and purchase invoices".into()],
        }),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_knowledge_base_creation() {
        let kb = TaxKnowledgeBase::new();
        assert!(!kb.list_all_concepts().is_empty());
    }

    #[test]
    fn test_get_concept() {
        let kb = TaxKnowledgeBase::new();
        let concept = kb.get_concept("bsn").expect("bsn should exist");
        assert_eq!(concept.term, "BSN");
    }

    #[test]
    fn test_extract_keywords() {
        let kb = TaxKnowledgeBase::new();
        let keywords = kb.extract_tax_keywords("My Jaaropgaaf shows dividend income");
        assert!(keywords.contains(&"jaaropgaaf".to_string()));
        assert!(keywords.contains(&"dividend".to_string()));
    }

    #[test]
    fn test_analyze_requirement_legacy_shape() {
        let kb = TaxKnowledgeBase::new();
        let analysis = kb.analyze_requirement("Please provide your WOZ-waarde and dividend overview");
        assert!(!analysis.concepts_needed.is_empty());
        assert_eq!(analysis.confidence, "high");
    }

    #[test]
    fn test_catalog_size_at_least_30() {
        let kb = TaxKnowledgeBase::new();
        assert!(
            kb.list_all_concepts().len() >= 30,
            "expected >=30 concepts, got {}",
            kb.list_all_concepts().len()
        );
    }

    #[test]
    fn test_required_concepts_present() {
        let kb = TaxKnowledgeBase::new();
        let required = [
            "hypotheekrenteaftrek",
            "eigenwoningforfait",
            "zelfstandigenaftrek",
            "oudedagsreserve",
            "mkb-winstvrijstelling",
            "kor",
            "urencriterium",
            "startersaftrek",
            "kleinschaligheidsinvesteringsaftrek",
            "kindgebonden-budget",
            "huurtoeslag",
            "kinderopvangtoeslag",
            "box-2",
            "box-4",
        ];
        let ids = kb.list_concept_ids();
        for r in required {
            assert!(
                ids.iter().any(|i| i == r),
                "missing required concept '{}': have {:?}",
                r,
                ids
            );
        }
    }

    #[test]
    fn test_year_metadata_roundtrip() {
        let kb = TaxKnowledgeBase::new();
        let mut serializable: HashMap<String, TaxConceptInfo> = HashMap::new();
        for c in kb.list_all_concepts() {
            serializable.insert(c.term.clone(), c);
        }
        let json = serde_json::to_string(&serializable).expect("serialize");
        let back: HashMap<String, TaxConceptInfo> = serde_json::from_str(&json).expect("deserialize");
        let original_jaar = serializable.values().find(|c| c.term == "Jaaropgaaf").unwrap().applicable_year;
        let back_jaar = back.values().find(|c| c.term == "Jaaropgaaf").unwrap().applicable_year;
        assert_eq!(original_jaar, Some(2025));
        assert_eq!(back_jaar, Some(2025));
    }

    #[test]
    fn test_persona_is_tax_tagged_positive() {
        assert!(persona_is_tax_tagged("Tax Advisor", ""));
        assert!(persona_is_tax_tagged("Belastingadviseur", ""));
        assert!(persona_is_tax_tagged("", "you help with aangifte and BTW"));
        assert!(persona_is_tax_tagged("My Accountant", ""));
    }

    #[test]
    fn test_persona_is_tax_tagged_negative() {
        assert!(!persona_is_tax_tagged("Marketing", "you help with copy"));
        assert!(!persona_is_tax_tagged("General", ""));
    }

    #[test]
    fn test_build_grounding_block_injection() {
        let kb = TaxKnowledgeBase::new();
        let block = kb.build_grounding_block("What is hypotheekrenteaftrek?", "Tax Advisor", "");
        assert!(block.injected, "should inject for tax persona + tax message");
        assert!(block.augmented_message.contains("## Tax Concepts Available"));
        assert!(
            block.consulted_concept_ids.contains(&"hypotheekrenteaftrek".to_string()),
            "ids: {:?}",
            block.consulted_concept_ids
        );
    }

    #[test]
    fn test_build_grounding_block_skip_non_tax_persona() {
        let kb = TaxKnowledgeBase::new();
        let block = kb.build_grounding_block(
            "What is hypotheekrenteaftrek?",
            "Marketing",
            "you help with copy",
        );
        assert!(!block.injected);
        assert_eq!(block.augmented_message, "What is hypotheekrenteaftrek?");
        assert!(block.consulted_concept_ids.is_empty());
    }

    #[test]
    fn test_build_grounding_block_skip_no_keywords() {
        let kb = TaxKnowledgeBase::new();
        let block = kb.build_grounding_block("Hello, how are you?", "Tax Advisor", "");
        assert!(!block.injected);
    }

    #[test]
    fn test_itemization_drie_bijlagen() {
        let kb = TaxKnowledgeBase::new();
        let analysis = kb.analyze_requirement("Stuur me alstublieft drie bijlagen en je BSN.");
        let attachment = analysis.items.iter().find(|i| i.attachment_required).expect("attachment item");
        assert_eq!(attachment.count, Some(3));
    }

    #[test]
    fn test_itemization_signature() {
        let kb = TaxKnowledgeBase::new();
        let analysis = kb.analyze_requirement("Vergeet niet uw handtekening op de aangifte.");
        assert!(analysis.items.iter().any(|i| i.signature_required));
    }

    #[test]
    fn test_load_from_disk_missing_file_falls_back() {
        let path = std::path::PathBuf::from("/this/path/does/not/exist/tax_catalog.json");
        let kb = TaxKnowledgeBase::new_with_overlay(&path);
        assert!(!kb.list_all_concepts().is_empty());
    }

    #[test]
    fn test_load_from_disk_roundtrip() {
        let kb = TaxKnowledgeBase::new();
        let mut map: HashMap<String, TaxConceptInfo> = HashMap::new();
        for id in kb.list_concept_ids() {
            map.insert(id.clone(), kb.get_concept(&id).unwrap());
        }
        let tmp_dir = std::env::temp_dir();
        let path = tmp_dir.join("tax_catalog_test.json");
        let mut f = std::fs::File::create(&path).expect("create tmp");
        f.write_all(serde_json::to_string(&map).unwrap().as_bytes()).expect("write tmp");
        let loaded = TaxKnowledgeBase::load_from_disk(&path).expect("load tmp");
        assert!(loaded.list_all_concepts().len() >= 30);
        let _ = std::fs::remove_file(&path);
    }
}

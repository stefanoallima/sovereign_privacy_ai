use std::path::Path;
use std::io::Read;
use log::{info, warn};

#[derive(Debug, Clone)]
pub struct ParsedDocument {
    pub filename: String,
    pub file_type: String,
    pub text_content: String,
    pub structure: DocumentStructure,
}

#[derive(Debug, Clone)]
pub struct DocumentStructure {
    pub page_count: usize,
    pub has_tables: bool,
    pub document_type: Option<String>, // "Jaaropgaaf", "WOZ", "Aangifte", "Medical", etc.
}

impl Default for DocumentStructure {
    fn default() -> Self {
        DocumentStructure {
            page_count: 1,
            has_tables: false,
            document_type: None,
        }
    }
}

/// Parse a document file (PDF, DOCX, or TXT) and extract text
pub fn parse_file(path: &Path) -> Result<ParsedDocument, Box<dyn std::error::Error>> {
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    info!("Parsing document: {} (type: {})", filename, extension);

    match extension.as_str() {
        "pdf" => parse_pdf(path, &filename),
        "docx" => parse_docx(path, &filename),
        "doc" => parse_docx(path, &filename),
        "txt" => parse_txt(path, &filename),
        _ => Err(format!("Unsupported file type: {}. Supported: PDF, DOCX, TXT", extension).into()),
    }
}

/// Parse plain text file
fn parse_txt(path: &Path, filename: &str) -> Result<ParsedDocument, Box<dyn std::error::Error>> {
    info!("Parsing TXT: {}", filename);

    let text_content = std::fs::read_to_string(path)?;
    let document_type = detect_document_type(&text_content);

    Ok(ParsedDocument {
        filename: filename.to_string(),
        file_type: "txt".to_string(),
        text_content,
        structure: DocumentStructure {
            page_count: 1,
            has_tables: false,
            document_type,
        },
    })
}

/// Parse PDF and extract text using the pdf crate
fn parse_pdf(path: &Path, filename: &str) -> Result<ParsedDocument, Box<dyn std::error::Error>> {
    info!("Parsing PDF: {}", filename);

    // Read PDF file bytes
    let bytes = std::fs::read(path)?;

    // Try to parse with pdf crate first
    let text_content = match extract_text_with_pdf_crate(&bytes) {
        Ok(text) if text.len() > 20 => text,
        Ok(_) | Err(_) => {
            warn!("pdf crate extraction failed or returned too little text, falling back to basic extraction");
            extract_text_from_pdf_bytes(&bytes)?
        }
    };

    // Detect document type based on content
    let document_type = detect_document_type(&text_content);

    // Estimate page count
    let page_count = estimate_pdf_page_count(&bytes);

    Ok(ParsedDocument {
        filename: filename.to_string(),
        file_type: "pdf".to_string(),
        text_content,
        structure: DocumentStructure {
            page_count,
            has_tables: false,
            document_type,
        },
    })
}

/// Parse DOCX and extract text using zip crate
fn parse_docx(path: &Path, filename: &str) -> Result<ParsedDocument, Box<dyn std::error::Error>> {
    info!("Parsing DOCX: {}", filename);

    let file = std::fs::File::open(path)?;

    // DOCX is a ZIP file containing XML
    let mut archive = zip::ZipArchive::new(file)?;

    // Try to get document.xml first
    let text_content = if let Some(index) = archive.index_for_name("word/document.xml") {
        let mut doc_file = archive.by_index(index)?;
        let mut xml_content = String::new();
        doc_file.read_to_string(&mut xml_content)?;
        extract_text_from_docx_xml(&xml_content)
    } else {
        // Fallback: try to find any XML file with text
        let mut all_text = String::new();
        let len = archive.len();
        for i in 0..len {
            let file_result = archive.by_index(i);
            if let Ok(mut file) = file_result {
                let name = file.name().to_string();
                if name.ends_with(".xml") {
                    let mut content = String::new();
                    if file.read_to_string(&mut content).is_ok() {
                        all_text.push_str(&extract_text_from_docx_xml(&content));
                        all_text.push(' ');
                    }
                }
            }
        }
        all_text
    };

    if text_content.len() < 10 {
        return Err("Could not extract text from DOCX. The document may be empty or corrupted.".into());
    }

    let document_type = detect_document_type(&text_content);

    Ok(ParsedDocument {
        filename: filename.to_string(),
        file_type: "docx".to_string(),
        text_content,
        structure: DocumentStructure {
            page_count: 1,
            has_tables: false,
            document_type,
        },
    })
}

/// Extract text from DOCX XML content
fn extract_text_from_docx_xml(xml: &str) -> String {
    let mut text = String::new();
    let mut in_text = false;
    let mut chars = xml.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '<' {
            // Check for <w:t> or <w:t ...>
            let mut tag = String::new();
            while let Some(&next) = chars.peek() {
                if next == '>' || next == ' ' {
                    break;
                }
                tag.push(chars.next().unwrap());
            }

            if tag == "w:t" {
                // Skip until >
                while chars.peek().is_some() {
                    if chars.next().unwrap() == '>' {
                        break;
                    }
                }
                in_text = true;
            } else if tag == "/w:t" {
                in_text = false;
                text.push(' ');
            } else if tag == "/w:p" || tag == "w:br" {
                // Paragraph or line break
                text.push('\n');
            }

            // Skip to end of tag
            while chars.peek().is_some() {
                if chars.next().unwrap() == '>' {
                    break;
                }
            }
        } else if in_text {
            text.push(c);
        }
    }

    // Clean up
    text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Try to extract text using the pdf crate
/// Note: The pdf crate has complex APIs for content streams.
/// We use a simpler approach - validate PDF structure then use byte-level extraction.
fn extract_text_with_pdf_crate(bytes: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
    use pdf::file::FileOptions;

    // Load the PDF to validate it's a proper PDF file
    let file = FileOptions::cached().load(bytes)?;

    // Get page count to ensure the PDF is valid
    let page_count = file.pages().count();
    if page_count == 0 {
        return Err("PDF has no pages".into());
    }

    // Use byte-level extraction since the pdf crate's content stream API is complex
    // This approach works better for most documents
    extract_text_from_pdf_bytes(bytes)
}

/// Fallback: Extract text from PDF bytes using basic pattern matching
fn extract_text_from_pdf_bytes(bytes: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
    let mut text = String::new();

    // Look for text between parentheses in PDF streams
    let mut in_paren = false;
    let mut escape_next = false;

    for &byte in bytes {
        if escape_next {
            escape_next = false;
            if in_paren && byte >= 32 && byte <= 126 {
                text.push(byte as char);
            }
            continue;
        }

        match byte {
            b'\\' if in_paren => escape_next = true,
            b'(' => in_paren = true,
            b')' => {
                in_paren = false;
                text.push(' ');
            }
            _ if in_paren && byte >= 32 && byte <= 126 => {
                text.push(byte as char);
            }
            _ => {}
        }
    }

    // Clean up
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if text.len() < 10 {
        return Err("Could not extract text from PDF. The document may be image-based or use unsupported encoding.".into());
    }

    Ok(text)
}

/// Detect document type based on content (tax, medical, financial, etc.)
fn detect_document_type(text: &str) -> Option<String> {
    let text_lower = text.to_lowercase();

    // Dutch tax documents
    if text_lower.contains("jaaropgaaf") {
        return Some("Tax: Jaaropgaaf".to_string());
    }
    if text_lower.contains("woz") && text_lower.contains("waarde") {
        return Some("Tax: WOZ-beschikking".to_string());
    }
    if text_lower.contains("aangifte") && text_lower.contains("inkomstenbelasting") {
        return Some("Tax: Aangifte Inkomstenbelasting".to_string());
    }
    if text_lower.contains("loonheffing") {
        return Some("Tax: Loonheffingsgegevens".to_string());
    }
    if text_lower.contains("zorgtoeslag") {
        return Some("Tax: Zorgtoeslag".to_string());
    }
    if text_lower.contains("belastingdienst") || text_lower.contains("tax return") {
        return Some("Tax Document".to_string());
    }

    // Financial documents
    if text_lower.contains("dividend") {
        return Some("Financial: Dividend Statement".to_string());
    }
    if text_lower.contains("bank statement") || text_lower.contains("rekeningafschrift") {
        return Some("Financial: Bank Statement".to_string());
    }
    if text_lower.contains("invoice") || text_lower.contains("factuur") {
        return Some("Financial: Invoice".to_string());
    }
    if text_lower.contains("salary") || text_lower.contains("salaris") || text_lower.contains("loonstrook") {
        return Some("Financial: Payslip".to_string());
    }

    // Medical documents
    if text_lower.contains("medical") || text_lower.contains("medisch") {
        return Some("Medical Record".to_string());
    }
    if text_lower.contains("prescription") || text_lower.contains("recept") {
        return Some("Medical: Prescription".to_string());
    }
    if text_lower.contains("diagnosis") || text_lower.contains("diagnose") {
        return Some("Medical: Diagnosis".to_string());
    }
    if text_lower.contains("hospital") || text_lower.contains("ziekenhuis") {
        return Some("Medical: Hospital Record".to_string());
    }

    // Identity documents
    if text_lower.contains("passport") || text_lower.contains("paspoort") {
        return Some("Identity: Passport".to_string());
    }
    if text_lower.contains("driver") && text_lower.contains("license") {
        return Some("Identity: Driver License".to_string());
    }
    if text_lower.contains("rijbewijs") {
        return Some("Identity: Rijbewijs".to_string());
    }

    // Employment documents
    if text_lower.contains("contract") && (text_lower.contains("employment") || text_lower.contains("arbeids")) {
        return Some("Employment: Contract".to_string());
    }
    if text_lower.contains("cv") || text_lower.contains("curriculum vitae") || text_lower.contains("resume") {
        return Some("Employment: CV/Resume".to_string());
    }

    // Check for PII patterns to classify as generic PII document
    let has_bsn = regex::Regex::new(r"\b\d{9}\b").map(|r| r.is_match(&text)).unwrap_or(false);
    let has_iban = text_lower.contains("iban") || regex::Regex::new(r"[A-Z]{2}\d{2}[A-Z0-9]{4,}").map(|r| r.is_match(&text)).unwrap_or(false);
    let has_phone = regex::Regex::new(r"\+?\d{10,12}").map(|r| r.is_match(&text)).unwrap_or(false);
    let has_email = text.contains("@") && text.contains(".");

    if has_bsn || has_iban || has_phone || has_email {
        return Some("Document with PII".to_string());
    }

    None
}

/// Estimate PDF page count from bytes
fn estimate_pdf_page_count(bytes: &[u8]) -> usize {
    let mut count = 0;
    let mut i = 0;

    while i + 5 < bytes.len() {
        if &bytes[i..i + 5] == b"/Page" {
            count += 1;
        }
        i += 1;
    }

    count.max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dutch_document_detection() {
        let jaaropgaaf_text = "Dit is een Jaaropgaaf voor belastingjaar 2024";
        assert_eq!(
            detect_dutch_document_type(jaaropgaaf_text),
            Some("Jaaropgaaf".to_string())
        );

        let woz_text = "WOZ-beschikking waarde van het object";
        assert_eq!(
            detect_dutch_document_type(woz_text),
            Some("WOZ-beschikking".to_string())
        );
    }

    #[test]
    fn test_text_extraction_filtering() {
        let text = extract_text_from_pdf_bytes(b"Hello World PDF Test")
            .unwrap_or_default();
        assert!(!text.is_empty());
    }
}

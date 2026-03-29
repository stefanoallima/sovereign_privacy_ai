use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write, Cursor};
use std::sync::OnceLock;
use zip::read::ZipArchive;
use zip::write::{ZipWriter, SimpleFileOptions};

/// Result of filling a DOCX template, including match statistics.
#[derive(Debug, Serialize, Deserialize)]
pub struct FillResult {
    pub bytes: Vec<u8>,
    pub matched_count: usize,
    pub unmatched_labels: Vec<String>,
}

/// Parts of XML files that should be processed for value injection.
const INJECTABLE_PARTS: &[&str] = &[
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footer2.xml",
];

/// Fill a DOCX template by injecting values next to field labels.
/// Opens the DOCX as ZIP, modifies word/document.xml and header/footer files,
/// returns a FillResult with the new DOCX bytes and match statistics.
pub fn fill_docx_template(
    template_path: &str,
    field_values: &HashMap<String, String>,
) -> Result<FillResult, String> {
    let file = std::fs::File::open(template_path)
        .map_err(|e| format!("Cannot open template: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid DOCX/ZIP: {}", e))?;

    // Track all unmatched labels across all injectable parts.
    // Start with all labels as unmatched; remove as they are found.
    let mut all_unmatched: Vec<String> = field_values.keys().cloned().collect();

    let mut output = Vec::new();
    {
        let mut writer = ZipWriter::new(Cursor::new(&mut output));

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)
                .map_err(|e| format!("ZIP entry error: {}", e))?;
            let name = entry.name().to_string();

            let mut contents = Vec::new();
            entry.read_to_end(&mut contents)
                .map_err(|e| format!("Read error: {}", e))?;

            let options = SimpleFileOptions::default()
                .compression_method(entry.compression());

            writer.start_file(&name, options)
                .map_err(|e| format!("Write error: {}", e))?;

            if INJECTABLE_PARTS.contains(&name.as_str()) {
                let xml_str = String::from_utf8_lossy(&contents).to_string();
                let normalized = normalize_xml_runs(&xml_str);
                let (filled_xml, unmatched_in_part) = inject_values_into_xml(&normalized, field_values);
                // A label is only truly unmatched if it was unmatched in ALL parts.
                all_unmatched.retain(|label| unmatched_in_part.contains(label));
                writer.write_all(filled_xml.as_bytes())
                    .map_err(|e| format!("Write XML error: {}", e))?;
            } else {
                writer.write_all(&contents)
                    .map_err(|e| format!("Write error: {}", e))?;
            }
        }

        writer.finish()
            .map_err(|e| format!("ZIP finish error: {}", e))?;
    }

    let total = field_values.len();
    let matched_count = total - all_unmatched.len();

    Ok(FillResult {
        bytes: output,
        matched_count,
        unmatched_labels: all_unmatched,
    })
}

/// Merge adjacent text runs within the same paragraph to handle Word's run-splitting.
/// This normalizes `</w:t></w:r><w:r><w:t>` into continuous text within `<w:t>`.
fn normalize_xml_runs(xml: &str) -> String {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        regex::Regex::new(
        r"</w:t></w:r>\s*<w:r(?:\s[^>]*)?>(?:<w:rPr>.*?</w:rPr>)?\s*<w:t(?:\s[^>]*)?>"
        ).unwrap()
    });
    re.replace_all(xml, "").to_string()
}

/// Inject field values into DOCX XML.
/// Strategy: find text nodes containing field labels, append/replace with values.
///
/// Returns  where  contains
/// the labels that were NOT found in the XML by any replacement strategy.
///
/// DOCX XML uses <w:t> tags for text. We look for patterns like:
/// - "Field Label: ___" -> "Field Label: Value"
/// - "[Field Label]" placeholder -> replace with value
/// - "{{Field Label}}" template syntax -> replace with value
fn inject_values_into_xml(xml: &str, field_values: &HashMap<String, String>) -> (String, Vec<String>) {
    let mut result = xml.to_string();
    let mut unmatched = Vec::new();

    for (label, value) in field_values {
        let safe_value = escape_xml(value);
        let safe_label = escape_xml(label);
        let before = result.clone();

        // Strategy 1: Replace "[Label]" placeholders
        let xml_placeholder = format!("[{}]", safe_label);
        result = result.replace(&xml_placeholder, &safe_value);

        // Strategy 2: Replace "Label: ___" or "Label: ........"
        let patterns = [
            format!("{}: ___", safe_label),
            format!("{}: ........", safe_label),
            format!("{}:___", safe_label),
            format!("{}: _____", safe_label),
            format!("{}: __________", safe_label),
        ];
        for pattern in &patterns {
            let replacement = format!("{}: {}", safe_label, safe_value);
            result = result.replace(pattern, &replacement);
        }

        // Strategy 3: Replace {{Label}} template syntax
        let xml_template = format!("{{{{{}}}}}", safe_label);
        result = result.replace(&xml_template, &safe_value);

        // Check if anything was actually replaced
        if result == before {
            unmatched.push(label.clone());
        }
    }

    (result, unmatched)
}

/// Escape XML special characters
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&apos;")
}

/// Generate a new DOCX file from field label-value pairs.
/// Used when the input was not a DOCX (e.g., PDF or TXT).
pub fn generate_docx(title: &str, fields: &[(String, String)]) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    {
        let mut writer = ZipWriter::new(Cursor::new(&mut output));
        let options = SimpleFileOptions::default();

        // [Content_Types].xml
        writer.start_file("[Content_Types].xml", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        writer.write_all(CONTENT_TYPES_XML.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;

        // _rels/.rels
        writer.start_file("_rels/.rels", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        writer.write_all(RELS_XML.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;

        // word/_rels/document.xml.rels
        writer.start_file("word/_rels/document.xml.rels", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        writer.write_all(DOCUMENT_RELS_XML.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;

        // word/document.xml
        writer.start_file("word/document.xml", options)
            .map_err(|e| format!("ZIP error: {}", e))?;
        let doc_xml = build_document_xml(title, fields);
        writer.write_all(doc_xml.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;

        writer.finish()
            .map_err(|e| format!("ZIP finish error: {}", e))?;
    }

    Ok(output)
}

fn build_document_xml(title: &str, fields: &[(String, String)]) -> String {
    let mut paragraphs = String::new();

    // Title paragraph
    paragraphs.push_str(&format!(
        r#"<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>{}</w:t></w:r></w:p>"#,
        escape_xml(title)
    ));

    // Field paragraphs
    for (label, value) in fields {
        paragraphs.push_str(&format!(
            r#"<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{}: </w:t></w:r><w:r><w:t>{}</w:t></w:r></w:p>"#,
            escape_xml(label),
            escape_xml(value)
        ));
    }

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            mc:Ignorable="w14 wp14">
<w:body>{}</w:body>
</w:document>"#,
        paragraphs
    )
}

const CONTENT_TYPES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#;

const RELS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;

const DOCUMENT_RELS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_xml() {
        assert_eq!(escape_xml("A & B"), "A &amp; B");
        assert_eq!(escape_xml("<tag>"), "&lt;tag&gt;");
    }

    #[test]
    fn test_inject_placeholder() {
        let xml = r#"<w:t>[Full Name]</w:t>"#;
        let mut values = HashMap::new();
        values.insert("Full Name".to_string(), "Jan Jansen".to_string());
        let (result, unmatched) = inject_values_into_xml(xml, &values);
        assert!(result.contains("Jan Jansen"));
        assert!(!result.contains("[Full Name]"));
        assert!(unmatched.is_empty());
    }

    #[test]
    fn test_inject_colon_pattern() {
        let xml = r#"<w:t>Email: ___</w:t>"#;
        let mut values = HashMap::new();
        values.insert("Email".to_string(), "test@example.com".to_string());
        let (result, unmatched) = inject_values_into_xml(xml, &values);
        assert!(result.contains("Email: test@example.com"));
        assert!(unmatched.is_empty());
    }

    #[test]
    fn test_generate_docx() {
        let fields = vec![
            ("Name".to_string(), "Test User".to_string()),
            ("Email".to_string(), "test@example.com".to_string()),
        ];
        let result = generate_docx("Test Form", &fields);
        assert!(result.is_ok());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        // Verify it is a valid ZIP
        let cursor = Cursor::new(&bytes);
        let archive = ZipArchive::new(cursor);
        assert!(archive.is_ok());
    }

    #[test]
    fn test_inject_template_syntax() {
        let xml = r#"<w:t>{{Name}}</w:t>"#;
        let mut values = HashMap::new();
        values.insert("Name".to_string(), "Jan".to_string());
        let (result, unmatched) = inject_values_into_xml(xml, &values);
        assert!(result.contains("Jan"));
        assert!(!result.contains("{{Name}}"));
        assert!(unmatched.is_empty());
    }

    #[test]
    fn test_generate_docx_is_valid_zip() {
        let fields = vec![
            ("Name".to_string(), "Alice".to_string()),
            ("Email".to_string(), "alice@example.com".to_string()),
        ];
        let bytes = generate_docx("My Form", &fields).unwrap();
        let cursor = Cursor::new(&bytes);
        let mut archive = ZipArchive::new(cursor).expect("Should be valid ZIP");
        // Must contain the standard DOCX entries
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"[Content_Types].xml".to_string()));
        assert!(names.contains(&"_rels/.rels".to_string()));
        assert!(names.contains(&"word/document.xml".to_string()));
        assert!(names.contains(&"word/_rels/document.xml.rels".to_string()));
    }

    #[test]
    fn test_generate_docx_contains_field_values() {
        let fields = vec![
            ("Full Name".to_string(), "Jan Jansen".to_string()),
            ("Email".to_string(), "jan@example.nl".to_string()),
        ];
        let bytes = generate_docx("Application Form", &fields).unwrap();
        let cursor = Cursor::new(&bytes);
        let mut archive = ZipArchive::new(cursor).unwrap();
        let mut doc_entry = archive.by_name("word/document.xml").unwrap();
        let mut xml = String::new();
        doc_entry.read_to_string(&mut xml).unwrap();
        assert!(xml.contains("Jan Jansen"));
        assert!(xml.contains("jan@example.nl"));
        assert!(xml.contains("Application Form"));
    }

    #[test]
    fn test_generate_docx_escapes_xml() {
        let fields = vec![
            ("Notes".to_string(), "A & B <test> \"quoted\"".to_string()),
        ];
        let bytes = generate_docx("Escaping Test", &fields).unwrap();
        let cursor = Cursor::new(&bytes);
        let mut archive = ZipArchive::new(cursor).unwrap();
        let mut doc_entry = archive.by_name("word/document.xml").unwrap();
        let mut xml = String::new();
        doc_entry.read_to_string(&mut xml).unwrap();
        // Should contain escaped forms, not raw special chars
        assert!(xml.contains("A &amp; B &lt;test&gt; &quot;quoted&quot;"));
    }

    #[test]
    fn test_inject_multiple_strategies() {
        let xml = r#"<w:t>[Name]</w:t><w:t>Email: ___</w:t><w:t>{{City}}</w:t>"#;
        let mut values = HashMap::new();
        values.insert("Name".to_string(), "Alice".to_string());
        values.insert("Email".to_string(), "a@b.com".to_string());
        values.insert("City".to_string(), "Amsterdam".to_string());
        let (result, unmatched) = inject_values_into_xml(xml, &values);
        assert!(result.contains("Alice"));
        assert!(!result.contains("[Name]"));
        assert!(result.contains("Email: a@b.com"));
        assert!(!result.contains("Email: ___"));
        assert!(result.contains("Amsterdam"));
        assert!(!result.contains("{{City}}"));
        assert!(unmatched.is_empty());
    }

    #[test]
    fn test_normalize_split_runs() {
        let xml = r#"<w:r><w:t>[Full</w:t></w:r><w:r><w:t> Name]</w:t></w:r>"#;
        let normalized = normalize_xml_runs(xml);
        assert!(normalized.contains("[Full Name]"), "Should merge split runs. Got: {}", normalized);
    }

    #[test]
    fn test_inject_with_split_runs() {
        let xml = r#"<w:r><w:t>[Full</w:t></w:r><w:r><w:t> Name]</w:t></w:r>"#;
        let normalized = normalize_xml_runs(xml);
        let mut values = HashMap::new();
        values.insert("Full Name".to_string(), "Jan Jansen".to_string());
        let (result, unmatched) = inject_values_into_xml(&normalized, &values);
        assert!(result.contains("Jan Jansen"));
        assert!(unmatched.is_empty());
    }

    #[test]
    fn test_normalize_split_runs_with_rpr() {
        let xml = r#"<w:r><w:t>[Full</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t> Name]</w:t></w:r>"#;
        let normalized = normalize_xml_runs(xml);
        assert!(normalized.contains("[Full Name]"), "Should merge runs with rPr. Got: {}", normalized);
    }

    #[test]
    fn test_fill_docx_template_round_trip() {
        // Step 1: Generate a DOCX with placeholder-style field labels
        let fields = vec![
            ("Name".to_string(), "[Name]".to_string()),
            ("Email".to_string(), "[Email]".to_string()),
        ];
        let template_bytes = generate_docx("Template", &fields).unwrap();

        // Step 2: Write to a temp file
        let tmp_dir = tempfile::tempdir().unwrap();
        let template_path = tmp_dir.path().join("template.docx");
        std::fs::write(&template_path, &template_bytes).unwrap();

        // Step 3: Fill the template with actual values
        let mut fill_values = HashMap::new();
        fill_values.insert("Name".to_string(), "Jan Jansen".to_string());
        fill_values.insert("Email".to_string(), "jan@test.nl".to_string());
        let fill_result = fill_docx_template(
            template_path.to_str().unwrap(),
            &fill_values,
        ).unwrap();

        assert_eq!(fill_result.matched_count, 2);
        assert!(fill_result.unmatched_labels.is_empty());

        // Step 4: Read the filled DOCX and verify values were injected
        let cursor = Cursor::new(&fill_result.bytes);
        let mut archive = ZipArchive::new(cursor).unwrap();
        let mut doc_entry = archive.by_name("word/document.xml").unwrap();
        let mut xml = String::new();
        doc_entry.read_to_string(&mut xml).unwrap();
        assert!(xml.contains("Jan Jansen"), "Filled DOCX should contain Jan Jansen");
        assert!(xml.contains("jan@test.nl"), "Filled DOCX should contain jan@test.nl");
        assert!(!xml.contains("[Name]"), "Placeholder [Name] should be replaced");
        assert!(!xml.contains("[Email]"), "Placeholder [Email] should be replaced");
    }

    #[test]
    fn test_inject_unmatched_labels() {
        let xml = r#"<w:t>[Name]</w:t>"#;
        let mut values = HashMap::new();
        values.insert("Name".to_string(), "Alice".to_string());
        values.insert("Missing Field".to_string(), "value".to_string());
        let (result, unmatched) = inject_values_into_xml(xml, &values);
        assert!(result.contains("Alice"));
        assert_eq!(unmatched.len(), 1);
        assert!(unmatched.contains(&"Missing Field".to_string()));
    }

    #[test]
    fn test_fill_result_reports_unmatched() {
        let fields = vec![
            ("Name".to_string(), "[Name]".to_string()),
        ];
        let template_bytes = generate_docx("Template", &fields).unwrap();
        let tmp_dir = tempfile::tempdir().unwrap();
        let template_path = tmp_dir.path().join("template.docx");
        std::fs::write(&template_path, &template_bytes).unwrap();

        let mut fill_values = HashMap::new();
        fill_values.insert("Name".to_string(), "Jan".to_string());
        fill_values.insert("Phone".to_string(), "+31612345678".to_string());
        let fill_result = fill_docx_template(
            template_path.to_str().unwrap(),
            &fill_values,
        ).unwrap();

        assert_eq!(fill_result.matched_count, 1);
        assert_eq!(fill_result.unmatched_labels.len(), 1);
        assert!(fill_result.unmatched_labels.contains(&"Phone".to_string()));
    }

}
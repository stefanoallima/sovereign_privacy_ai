use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextChunk {
    pub text: String,
    pub position: usize,     // chunk index (0-based)
    pub char_offset: usize,  // start position in original text
    pub char_length: usize,
}

/// Split text into chunks of approximately `chunk_size` chars with `overlap` char overlap.
/// Splits on paragraph boundaries when possible, falls back to sentence boundaries.
pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<TextChunk> {
    if text.trim().is_empty() {
        return vec![];
    }

    let chunk_size = chunk_size.max(100); // minimum 100 chars
    let overlap = overlap.min(chunk_size / 2); // max 50% overlap

    // Split into paragraphs first
    let paragraphs: Vec<&str> = text.split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    if paragraphs.is_empty() {
        return vec![TextChunk {
            text: text.trim().to_string(),
            position: 0,
            char_offset: 0,
            char_length: text.trim().len(),
        }];
    }

    let mut chunks = Vec::new();
    let mut current_chunk = String::new();
    let mut current_offset = 0;
    let mut chunk_start_offset = 0;

    for para in &paragraphs {
        // If adding this paragraph would exceed chunk_size
        if !current_chunk.is_empty() && current_chunk.len() + para.len() + 2 > chunk_size {
            // Emit current chunk
            chunks.push(TextChunk {
                text: current_chunk.trim().to_string(),
                position: chunks.len(),
                char_offset: chunk_start_offset,
                char_length: current_chunk.trim().len(),
            });

            // Start new chunk with overlap from the end of the previous chunk
            if overlap > 0 && current_chunk.len() > overlap {
                let overlap_text = &current_chunk[current_chunk.len() - overlap..];
                // Find a word boundary for cleaner overlap
                let word_start = overlap_text.find(' ').unwrap_or(0);
                current_chunk = overlap_text[word_start..].trim().to_string();
                chunk_start_offset = current_offset - (overlap - word_start);
            } else {
                current_chunk.clear();
                chunk_start_offset = current_offset;
            }
        }

        if !current_chunk.is_empty() {
            current_chunk.push_str("\n\n");
        } else {
            chunk_start_offset = current_offset;
        }
        current_chunk.push_str(para);
        current_offset += para.len() + 2; // +2 for \n\n
    }

    // Emit final chunk
    if !current_chunk.trim().is_empty() {
        chunks.push(TextChunk {
            text: current_chunk.trim().to_string(),
            position: chunks.len(),
            char_offset: chunk_start_offset,
            char_length: current_chunk.trim().len(),
        });
    }

    // Handle case where single paragraph is longer than chunk_size -- split by sentences
    let mut final_chunks = Vec::new();
    for chunk in chunks {
        if chunk.text.len() > chunk_size * 2 {
            // Split oversized chunks by sentences
            let sub_chunks = split_by_sentences(&chunk.text, chunk_size, overlap);
            for (_i, sub) in sub_chunks.into_iter().enumerate() {
                final_chunks.push(TextChunk {
                    text: sub.clone(),
                    position: final_chunks.len(),
                    char_offset: chunk.char_offset,
                    char_length: sub.len(),
                });
            }
        } else {
            let mut c = chunk;
            c.position = final_chunks.len();
            final_chunks.push(c);
        }
    }

    final_chunks
}

fn split_by_sentences(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let sentences: Vec<&str> = text.split_inclusive(|c: char| c == '.' || c == '!' || c == '?')
        .collect();

    let mut chunks = Vec::new();
    let mut current = String::new();

    for sentence in &sentences {
        if !current.is_empty() && current.len() + sentence.len() > chunk_size {
            chunks.push(current.trim().to_string());
            // Overlap: keep last part
            if overlap > 0 && current.len() > overlap {
                current = current[current.len() - overlap..].trim().to_string();
            } else {
                current.clear();
            }
        }
        current.push_str(sentence);
    }
    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }
    chunks
}

/// Convenience: chunk with default settings (512 chars, 64 overlap)
pub fn chunk_text_default(text: &str) -> Vec<TextChunk> {
    chunk_text(text, 512, 64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_text() {
        assert!(chunk_text("", 512, 64).is_empty());
        assert!(chunk_text("   ", 512, 64).is_empty());
    }

    #[test]
    fn test_short_text() {
        let chunks = chunk_text("Hello world.", 512, 64);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "Hello world.");
        assert_eq!(chunks[0].position, 0);
    }

    #[test]
    fn test_paragraph_splitting() {
        let text = "First paragraph with enough text to be meaningful.\n\nSecond paragraph also with content.\n\nThird paragraph here.";
        let chunks = chunk_text(text, 60, 0);
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_chunk_positions_sequential() {
        let text = (0..20).map(|i| format!("Paragraph {}. Some filler text here.", i)).collect::<Vec<_>>().join("\n\n");
        let chunks = chunk_text(&text, 200, 0);
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.position, i);
        }
    }

    #[test]
    fn test_default_chunker() {
        let text = "Short text.";
        let chunks = chunk_text_default(text);
        assert_eq!(chunks.len(), 1);
    }
}

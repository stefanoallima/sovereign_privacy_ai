use crate::db::Person;
use strsim::levenshtein;
use log::{info, debug};

const MATCH_THRESHOLD: f32 = 0.85; // 85% similarity threshold
const HIGH_CONFIDENCE_THRESHOLD: f32 = 0.90;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EntityMatch {
    pub person: Person,
    pub score: f32,
    pub confidence: String, // "high", "medium", "low"
}

/// Entity resolver for fuzzy name matching
pub struct EntityResolver;

impl EntityResolver {
    /// Find matching persons based on name similarity
    pub fn find_matches(
        extracted_name: &str,
        existing_persons: &[Person],
    ) -> Vec<EntityMatch> {
        info!("Finding matches for name: '{}'", extracted_name);

        let mut matches: Vec<EntityMatch> = existing_persons
            .iter()
            .filter_map(|person| {
                let score = Self::calculate_similarity(&extracted_name, &person.name);

                if score >= MATCH_THRESHOLD {
                    let confidence = if score >= HIGH_CONFIDENCE_THRESHOLD {
                        "high".to_string()
                    } else if score >= 0.90 {
                        "medium".to_string()
                    } else {
                        "low".to_string()
                    };

                    debug!("Match found: {} (score: {:.2})", person.name, score);

                    Some(EntityMatch {
                        person: person.clone(),
                        score,
                        confidence,
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort by score descending
        matches.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        info!("Found {} potential matches", matches.len());

        matches
    }

    /// Calculate name similarity using Levenshtein distance
    fn calculate_similarity(name1: &str, name2: &str) -> f32 {
        let name1_lower = name1.to_lowercase();
        let name2_lower = name2.to_lowercase();

        // If names are identical
        if name1_lower == name2_lower {
            return 1.0;
        }

        // Calculate base Levenshtein distance similarity
        let max_len = name1_lower.len().max(name2_lower.len());
        if max_len == 0 {
            return 1.0;
        }

        let distance = levenshtein(&name1_lower, &name2_lower);
        let similarity = 1.0 - (distance as f32 / max_len as f32);

        // Apply bonus for initials matching
        let similarity = Self::apply_initial_bonus(&name1_lower, &name2_lower, similarity);

        // Apply bonus for first/last name component matching
        let similarity =
            Self::apply_component_bonus(&name1_lower, &name2_lower, similarity);

        similarity.max(0.0).min(1.0) // Clamp to [0, 1]
    }

    /// Apply bonus if initials match (e.g., "J. Jansen" vs "Jan Jansen")
    fn apply_initial_bonus(name1: &str, name2: &str, mut similarity: f32) -> f32 {
        let parts1: Vec<&str> = name1.split_whitespace().collect();
        let parts2: Vec<&str> = name2.split_whitespace().collect();

        if parts1.is_empty() || parts2.is_empty() {
            return similarity;
        }

        // Check if last names match
        if let (Some(last1), Some(last2)) = (parts1.last(), parts2.last()) {
            if Self::names_match_initial_or_full(last1, last2) {
                similarity += 0.05; // 5% bonus for last name match
            }
        }

        // Check if first names match by initial or full
        if !parts1.is_empty() && !parts2.is_empty() {
            if Self::names_match_initial_or_full(parts1[0], parts2[0]) {
                similarity += 0.05; // 5% bonus for first name match
            }
        }

        similarity.min(1.0)
    }

    /// Apply bonus if name components match
    fn apply_component_bonus(name1: &str, name2: &str, mut similarity: f32) -> f32 {
        // Check if any word from name1 appears in name2
        let words1: Vec<&str> = name1.split_whitespace().collect();
        let words2: Vec<&str> = name2.split_whitespace().collect();

        let mut matching_components = 0;
        for word1 in &words1 {
            for word2 in &words2 {
                if word1.len() > 2 && word2.len() > 2 && word1 == word2 {
                    matching_components += 1;
                }
            }
        }

        if matching_components > 0 {
            similarity += 0.03 * matching_components.min(2) as f32;
        }

        similarity.min(1.0)
    }

    /// Check if names match by initial or full name
    fn names_match_initial_or_full(name1: &str, name2: &str) -> bool {
        // Full match
        if name1 == name2 {
            return true;
        }

        // Initial match (first letter + period)
        if name1.ends_with('.') && name1.len() >= 2 {
            let initial = name1.chars().next().unwrap().to_lowercase().to_string();
            return name2.to_lowercase().starts_with(&initial);
        }

        if name2.ends_with('.') && name2.len() >= 2 {
            let initial = name2.chars().next().unwrap().to_lowercase().to_string();
            return name1.to_lowercase().starts_with(&initial);
        }

        false
    }

    /// Decide whether to create new person or use existing match
    pub fn should_create_new_person(matches: &[EntityMatch]) -> bool {
        if matches.is_empty() {
            return true;
        }

        // If best match is below threshold, create new
        if matches[0].score < MATCH_THRESHOLD {
            return true;
        }

        // If multiple high-confidence matches, let user decide (don't auto-create)
        let high_confidence_count = matches
            .iter()
            .filter(|m| m.score >= HIGH_CONFIDENCE_THRESHOLD)
            .count();

        high_confidence_count > 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_person(id: &str, name: &str) -> Person {
        Person {
            id: id.to_string(),
            household_id: "hh1".to_string(),
            name: name.to_string(),
            relationship: "primary".to_string(),
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        }
    }

    #[test]
    fn test_exact_name_match() {
        let persons = vec![create_test_person("p1", "Jan Jansen")];
        let matches = EntityResolver::find_matches("Jan Jansen", &persons);

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].score, 1.0);
    }

    #[test]
    fn test_partial_name_match() {
        let persons = vec![create_test_person("p1", "Jan Jansen")];
        let matches = EntityResolver::find_matches("J. Jansen", &persons);

        assert!(!matches.is_empty());
        assert!(matches[0].score > MATCH_THRESHOLD);
    }

    #[test]
    fn test_misspelled_name_match() {
        let persons = vec![create_test_person("p1", "Jan Jansen")];
        let matches = EntityResolver::find_matches("Jan Janssen", &persons); // Double 's'

        assert!(!matches.is_empty());
        assert!(matches[0].score > 0.85);
    }

    #[test]
    fn test_no_match_with_low_similarity() {
        let persons = vec![create_test_person("p1", "Jan Jansen")];
        let matches = EntityResolver::find_matches("Jane Smith", &persons);

        // Should not match if below threshold
        assert!(matches.is_empty());
    }

    #[test]
    fn test_multiple_persons_sorted_by_score() {
        let persons = vec![
            create_test_person("p1", "Jan Jansen"),
            create_test_person("p2", "Jane Jansen"),
            create_test_person("p3", "John Smith"),
        ];

        let matches = EntityResolver::find_matches("Jan Jansen", &persons);

        assert!(matches.len() >= 1);
        // Best match should be exact "Jan Jansen"
        assert_eq!(matches[0].person.name, "Jan Jansen");
    }

    #[test]
    fn test_should_create_new_person() {
        let persons_empty: Vec<Person> = vec![];
        assert!(EntityResolver::should_create_new_person(&persons_empty));

        let high_conf_match = EntityMatch {
            person: create_test_person("p1", "Jan Jansen"),
            score: 0.95,
            confidence: "high".to_string(),
        };
        assert!(!EntityResolver::should_create_new_person(&[high_conf_match]));
    }
}

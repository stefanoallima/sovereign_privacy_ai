use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBase {
    pub id: String,
    pub name: String,
    pub description: String,
    pub document_count: i64,
    pub chunk_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbDocument {
    pub id: String,
    pub kb_id: String,
    pub name: String,
    pub file_type: String,
    pub chunk_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbChunk {
    pub id: i64,
    pub doc_id: String,
    pub kb_id: String,
    pub text: String,
    pub position: i64,
    pub relevance_score: Option<f64>,
}

pub struct KnowledgeStore {
    db_path: PathBuf,
}

impl KnowledgeStore {
    pub fn new(data_dir: &PathBuf) -> Result<Self, String> {
        let db_path = data_dir.join("knowledge.db");
        let store = Self { db_path };
        store.init_db()?;
        Ok(store)
    }

    fn init_db(&self) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS kb_documents (
                id TEXT PRIMARY KEY,
                kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL DEFAULT 'txt',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS kb_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
                kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
                text,
                content='kb_chunks',
                content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
                INSERT INTO kb_chunks_fts(rowid, text) VALUES (new.id, new.text);
            END;
            CREATE TRIGGER IF NOT EXISTS kb_chunks_ad AFTER DELETE ON kb_chunks BEGIN
                INSERT INTO kb_chunks_fts(kb_chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
            END;
            CREATE TRIGGER IF NOT EXISTS kb_chunks_au AFTER UPDATE ON kb_chunks BEGIN
                INSERT INTO kb_chunks_fts(kb_chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
                INSERT INTO kb_chunks_fts(rowid, text) VALUES (new.id, new.text);
            END;
        ").map_err(|e| format!("Failed to init knowledge DB: {}", e))?;

        info!("KnowledgeStore initialized at {}", self.db_path.display());
        Ok(())
    }

    fn connect(&self) -> Result<Connection, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open knowledge DB at {}: {}", self.db_path.display(), e))?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;
        Ok(conn)
    }

    // --- Knowledge Base CRUD ---

    pub fn create_kb(&self, id: &str, name: &str, description: &str) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO knowledge_bases (id, name, description) VALUES (?1, ?2, ?3)",
            params![id, name, description],
        ).map_err(|e| format!("Failed to create KB: {}", e))?;
        info!("Created knowledge base id={} name={}", id, name);
        Ok(())
    }

    pub fn list_kbs(&self) -> Result<Vec<KnowledgeBase>, String> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT kb.id, kb.name, kb.description,
                    (SELECT COUNT(*) FROM kb_documents WHERE kb_id = kb.id) as doc_count,
                    (SELECT COUNT(*) FROM kb_chunks WHERE kb_id = kb.id) as chunk_count,
                    kb.created_at
             FROM knowledge_bases kb
             ORDER BY kb.created_at DESC"
        ).map_err(|e| format!("List KBs failed: {}", e))?;

        let kbs = stmt.query_map([], |row| {
            Ok(KnowledgeBase {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                document_count: row.get(3)?,
                chunk_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        }).map_err(|e| format!("Query failed: {}", e))?
          .filter_map(|r| match r {
              Ok(val) => Some(val),
              Err(e) => {
                  log::warn!("Failed to read DB row: {}", e);
                  None
              }
          })
          .collect();
        Ok(kbs)
    }

    pub fn delete_kb(&self, kb_id: &str) -> Result<(), String> {
        let mut conn = self.connect()?;
        let tx = conn.transaction().map_err(|e| format!("Transaction failed: {}", e))?;
        tx.execute("DELETE FROM kb_chunks WHERE kb_id = ?1", params![kb_id]).ok();
        tx.execute("DELETE FROM kb_documents WHERE kb_id = ?1", params![kb_id]).ok();
        tx.execute("DELETE FROM knowledge_bases WHERE id = ?1", params![kb_id])
            .map_err(|e| format!("Delete KB failed: {}", e))?;
        tx.commit().map_err(|e| format!("Commit failed: {}", e))?;
        info!("Deleted knowledge base id={}", kb_id);
        Ok(())
    }

    // --- Document CRUD ---

    pub fn add_document(&self, doc_id: &str, kb_id: &str, name: &str, file_type: &str) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO kb_documents (id, kb_id, name, file_type) VALUES (?1, ?2, ?3, ?4)",
            params![doc_id, kb_id, name, file_type],
        ).map_err(|e| format!("Failed to add document: {}", e))?;
        info!("Added document id={} to KB {}", doc_id, kb_id);
        Ok(())
    }

    pub fn list_documents(&self, kb_id: &str) -> Result<Vec<KbDocument>, String> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT d.id, d.kb_id, d.name, d.file_type,
                    (SELECT COUNT(*) FROM kb_chunks WHERE doc_id = d.id) as chunk_count,
                    d.created_at
             FROM kb_documents d
             WHERE d.kb_id = ?1
             ORDER BY d.created_at DESC"
        ).map_err(|e| format!("List docs failed: {}", e))?;

        let docs = stmt.query_map(params![kb_id], |row| {
            Ok(KbDocument {
                id: row.get(0)?,
                kb_id: row.get(1)?,
                name: row.get(2)?,
                file_type: row.get(3)?,
                chunk_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        }).map_err(|e| format!("Query failed: {}", e))?
          .filter_map(|r| match r {
              Ok(val) => Some(val),
              Err(e) => {
                  log::warn!("Failed to read DB row: {}", e);
                  None
              }
          })
          .collect();
        Ok(docs)
    }

    pub fn delete_document(&self, doc_id: &str) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM kb_chunks WHERE doc_id = ?1", params![doc_id])
            .map_err(|e| format!("Delete doc chunks failed: {}", e))?;
        conn.execute("DELETE FROM kb_documents WHERE id = ?1", params![doc_id])
            .map_err(|e| format!("Delete doc failed: {}", e))?;
        info!("Deleted document id={}", doc_id);
        Ok(())
    }

    // --- Chunk operations ---

    pub fn add_chunks(&self, chunks: &[(String, String, String, i64)]) -> Result<usize, String> {
        let conn = self.connect()?;
        let mut count = 0;
        for (doc_id, kb_id, text, position) in chunks {
            conn.execute(
                "INSERT INTO kb_chunks (doc_id, kb_id, text, position) VALUES (?1, ?2, ?3, ?4)",
                params![doc_id, kb_id, text, position],
            ).map_err(|e| format!("Add chunk failed: {}", e))?;
            count += 1;
        }
        info!("Added {} chunks", count);
        Ok(count)
    }

    /// Search chunks using FTS5 across specified knowledge bases.
    pub fn search_chunks(&self, query: &str, kb_ids: &[String], top_k: usize) -> Result<Vec<KbChunk>, String> {
        let conn = self.connect()?;

        let clean_query: String = query.chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect();
        let fts_query = clean_query.split_whitespace()
            .filter(|w| w.len() >= 2)
            .collect::<Vec<_>>()
            .join(" OR ");

        if fts_query.is_empty() || kb_ids.is_empty() {
            return Ok(vec![]);
        }

        let placeholders: Vec<String> = kb_ids.iter().enumerate()
            .map(|(i, _)| format!("?{}", i + 3))
            .collect();
        let kb_filter = placeholders.join(", ");

        let sql = format!(
            "SELECT c.id, c.doc_id, c.kb_id, c.text, c.position, rank * -1.0 as score
             FROM kb_chunks c
             JOIN kb_chunks_fts ON kb_chunks_fts.rowid = c.id
             WHERE kb_chunks_fts MATCH ?1 AND c.kb_id IN ({})
             ORDER BY rank
             LIMIT ?2",
            kb_filter
        );

        let mut stmt = conn.prepare(&sql)
            .map_err(|e| format!("Search prepare failed: {}", e))?;

        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        param_values.push(Box::new(fts_query));
        param_values.push(Box::new(top_k as i64));
        for kb_id in kb_ids {
            param_values.push(Box::new(kb_id.clone()));
        }
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter()
            .map(|p| p.as_ref())
            .collect();

        let chunks = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(KbChunk {
                id: row.get(0)?,
                doc_id: row.get(1)?,
                kb_id: row.get(2)?,
                text: row.get(3)?,
                position: row.get(4)?,
                relevance_score: row.get(5)?,
            })
        }).map_err(|e| format!("Search query failed: {}", e))?
          .filter_map(|r| match r {
              Ok(val) => Some(val),
              Err(e) => {
                  log::warn!("Failed to read DB row: {}", e);
                  None
              }
          })
          .collect();

        Ok(chunks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_store() -> (KnowledgeStore, TempDir) {
        let dir = TempDir::new().unwrap();
        let store = KnowledgeStore::new(&dir.path().to_path_buf()).unwrap();
        (store, dir)
    }

    #[test]
    fn test_create_and_list_kb() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "Test KB", "A test knowledge base").unwrap();
        let kbs = store.list_kbs().unwrap();
        assert_eq!(kbs.len(), 1);
        assert_eq!(kbs[0].id, "kb-1");
        assert_eq!(kbs[0].name, "Test KB");
        assert_eq!(kbs[0].document_count, 0);
        assert_eq!(kbs[0].chunk_count, 0);
    }

    #[test]
    fn test_delete_kb_cascades() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "file.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "chunk text one".into(), 0),
            ("doc-1".into(), "kb-1".into(), "chunk text two".into(), 1),
        ]).unwrap();
        store.delete_kb("kb-1").unwrap();
        let kbs = store.list_kbs().unwrap();
        assert_eq!(kbs.len(), 0);
    }

    #[test]
    fn test_search_chunks_fts() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "file.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "The quick brown fox jumps".into(), 0),
            ("doc-1".into(), "kb-1".into(), "How vexingly quick daft zebras".into(), 1),
        ]).unwrap();
        let results = store.search_chunks("quick fox", &["kb-1".to_string()], 10).unwrap();
        assert!(!results.is_empty());
    }

    #[test]
    fn test_search_empty_query() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "f.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "some text".into(), 0),
        ]).unwrap();
        let r = store.search_chunks("", &["kb-1".to_string()], 5).unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn test_search_across_multiple_kbs() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "First", "").unwrap();
        store.create_kb("kb-2", "Second", "").unwrap();
        store.add_document("doc-1", "kb-1", "a.txt", "txt").unwrap();
        store.add_document("doc-2", "kb-2", "b.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "machine learning".into(), 0),
            ("doc-2".into(), "kb-2".into(), "deep learning".into(), 0),
        ]).unwrap();
        let results = store.search_chunks(
            "learning",
            &["kb-1".to_string(), "kb-2".to_string()],
            10,
        ).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_special_chars_query() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "file.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "some normal text".into(), 0),
        ]).unwrap();
        // Search with special chars should return empty, not crash
        let results = store.search_chunks("@#$%^&*()", &["kb-1".to_string()], 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_single_char_words() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "file.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "some text here".into(), 0),
        ]).unwrap();
        // Words < 2 chars get filtered, should not crash
        let results = store.search_chunks("I a", &["kb-1".to_string()], 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_unicode_text() {
        let (store, _dir) = make_store();
        store.create_kb("kb-1", "KB", "").unwrap();
        store.add_document("doc-1", "kb-1", "file.txt", "txt").unwrap();
        store.add_chunks(&[
            ("doc-1".into(), "kb-1".into(), "Huur subsidie informatie".into(), 0),
        ]).unwrap();
        // Search with unicode text should find it
        let results = store.search_chunks("subsidie", &["kb-1".to_string()], 10).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].text.contains("subsidie"));
    }
}

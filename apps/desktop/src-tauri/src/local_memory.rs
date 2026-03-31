use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: i64,
    pub text: String,
    pub conversation_id: Option<String>,
    pub role: String,
    pub created_at: String,
    pub relevance_score: Option<f64>,
}

pub struct LocalMemoryStore {
    db_path: PathBuf,
}

impl LocalMemoryStore {
    pub fn new(data_dir: &PathBuf) -> Result<Self, String> {
        let db_path = data_dir.join("memories.db");
        let store = Self { db_path };
        store.init_db()?;
        Ok(store)
    }

    fn init_db(&self) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                conversation_id TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                text,
                content='memories',
                content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, text) VALUES (new.id, new.text);
            END;
            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, text) VALUES('delete', old.id, old.text);
            END;
            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, text) VALUES('delete', old.id, old.text);
                INSERT INTO memories_fts(rowid, text) VALUES (new.id, new.text);
            END;
        ").map_err(|e| format!("Failed to init memory DB: {}", e))?;

        info!("LocalMemoryStore initialized at {}", self.db_path.display());
        Ok(())
    }

    fn connect(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open memory DB at {}: {}", self.db_path.display(), e))
    }

    /// Store a new memory entry and return its row id.
    pub fn add_memory(&self, text: &str, conversation_id: Option<&str>, role: &str) -> Result<i64, String> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO memories (text, conversation_id, role) VALUES (?1, ?2, ?3)",
            params![text, conversation_id, role],
        ).map_err(|e| format!("Failed to add memory: {}", e))?;

        let id = conn.last_insert_rowid();
        info!("Added memory id={} role={} len={}", id, role, text.len());
        Ok(id)
    }

    /// Search memories using FTS5 full-text search.
    /// Words shorter than 2 characters are ignored.
    /// Returns results ranked by relevance (best match first).
    pub fn search_memories(&self, query: &str, top_k: usize) -> Result<Vec<Memory>, String> {
        let conn = self.connect()?;

        // Clean the query for FTS5: keep only alphanumeric + whitespace, split into
        // words of length >= 2, join with OR for a broad match.
        let clean_query: String = query.chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect();
        let fts_query = clean_query
            .split_whitespace()
            .filter(|w| w.len() >= 2)
            .collect::<Vec<_>>()
            .join(" OR ");

        if fts_query.is_empty() {
            // No valid search terms -- fall back to most recent memories
            return self.recent_memories(top_k);
        }

        let mut stmt = conn.prepare(
            "SELECT m.id, m.text, m.conversation_id, m.role, m.created_at,
                    rank * -1.0 as relevance_score
             FROM memories m
             JOIN memories_fts ON memories_fts.rowid = m.id
             WHERE memories_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2"
        ).map_err(|e| format!("Search prepare failed: {}", e))?;

        let memories = stmt.query_map(params![fts_query, top_k as i64], |row| {
            Ok(Memory {
                id: row.get(0)?,
                text: row.get(1)?,
                conversation_id: row.get(2)?,
                role: row.get(3)?,
                created_at: row.get(4)?,
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

        Ok(memories)
    }

    /// Return the most recent memories, newest first.
    pub fn recent_memories(&self, limit: usize) -> Result<Vec<Memory>, String> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, text, conversation_id, role, created_at, NULL as relevance_score
             FROM memories
             ORDER BY created_at DESC
             LIMIT ?1"
        ).map_err(|e| format!("Recent query failed: {}", e))?;

        let memories = stmt.query_map(params![limit as i64], |row| {
            Ok(Memory {
                id: row.get(0)?,
                text: row.get(1)?,
                conversation_id: row.get(2)?,
                role: row.get(3)?,
                created_at: row.get(4)?,
                relevance_score: row.get(5)?,
            })
        }).map_err(|e| format!("Recent query failed: {}", e))?
          .filter_map(|r| match r {
              Ok(val) => Some(val),
              Err(e) => {
                  log::warn!("Failed to read DB row: {}", e);
                  None
              }
          })
          .collect();

        Ok(memories)
    }

    /// Delete all memories associated with a conversation.
    pub fn delete_memories_by_conversation(&self, conversation_id: &str) -> Result<usize, String> {
        let conn = self.connect()?;
        let count = conn.execute(
            "DELETE FROM memories WHERE conversation_id = ?1",
            params![conversation_id],
        ).map_err(|e| format!("Delete failed: {}", e))?;
        info!("Deleted {} memories for conversation {}", count, conversation_id);
        Ok(count)
    }

    /// Return total number of stored memories.
    pub fn memory_count(&self) -> Result<usize, String> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM memories",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Count failed: {}", e))?;
        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_store() -> (LocalMemoryStore, TempDir) {
        let dir = TempDir::new().unwrap();
        let store = LocalMemoryStore::new(&dir.path().to_path_buf()).unwrap();
        (store, dir)
    }

    #[test]
    fn test_add_and_count() {
        let (store, _dir) = make_store();
        assert_eq!(store.memory_count().unwrap(), 0);

        store.add_memory("hello world", None, "user").unwrap();
        assert_eq!(store.memory_count().unwrap(), 1);

        store.add_memory("second memory", Some("conv-1"), "assistant").unwrap();
        assert_eq!(store.memory_count().unwrap(), 2);
    }

    #[test]
    fn test_search_fts() {
        let (store, _dir) = make_store();
        store.add_memory("The quick brown fox jumps over the lazy dog", None, "user").unwrap();
        store.add_memory("Pack my box with five dozen liquor jugs", None, "user").unwrap();
        store.add_memory("How vexingly quick daft zebras jump", None, "user").unwrap();

        let results = store.search_memories("quick jump", 10).unwrap();
        assert!(!results.is_empty());
        assert!(results.len() >= 2);
    }

    #[test]
    fn test_search_empty_query() {
        let (store, _dir) = make_store();
        store.add_memory("first", None, "user").unwrap();
        store.add_memory("second", None, "user").unwrap();

        // Empty query returns recent memories
        let results = store.search_memories("", 5).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_recent_memories() {
        let (store, _dir) = make_store();
        for i in 0..10 {
            store.add_memory(&format!("memory {}", i), None, "user").unwrap();
        }

        let recent = store.recent_memories(3).unwrap();
        assert_eq!(recent.len(), 3);
    }

    #[test]
    fn test_delete_by_conversation() {
        let (store, _dir) = make_store();
        store.add_memory("msg1", Some("conv-a"), "user").unwrap();
        store.add_memory("msg2", Some("conv-a"), "assistant").unwrap();
        store.add_memory("msg3", Some("conv-b"), "user").unwrap();

        let deleted = store.delete_memories_by_conversation("conv-a").unwrap();
        assert_eq!(deleted, 2);
        assert_eq!(store.memory_count().unwrap(), 1);
    }

    #[test]
    fn test_search_special_chars() {
        let (store, _dir) = make_store();
        store.add_memory("some normal text", None, "user").unwrap();
        // Search with special chars should not crash
        let results = store.search_memories("@#$%^&*()", 10).unwrap();
        // Special chars are stripped, query becomes empty, falls back to recent
        assert!(!results.is_empty());
    }
}

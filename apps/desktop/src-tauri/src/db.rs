use rusqlite::{Connection, Result, params};
use directories::ProjectDirs;
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub persona_id: String,
    pub model_id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub total_tokens_used: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub model_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub latency_ms: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub voice_id: String,
    pub preferred_model_id: String,
    pub temperature: f64,
    pub max_tokens: i64,
    pub is_built_in: bool,
    pub created_at: String,
    pub updated_at: String,
    // LLM Backend Configuration (Proposal 3: Persona Backend Config)
    pub enable_local_anonymizer: bool,
    pub preferred_backend: String, // 'nebius' | 'ollama' | 'hybrid'
    pub anonymization_mode: String, // 'none' | 'optional' | 'required'
    pub local_ollama_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalContext {
    pub id: String,
    pub name: String,
    pub content: String,
    pub token_count: i64,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

// PII Management structures (Proposal 1: Anonymization)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PiiMapping {
    pub id: String,
    pub conversation_id: String,
    pub pii_category: String,
    pub pii_value_encrypted: Vec<u8>,
    pub placeholder: String,
    pub is_encrypted: bool,
    pub created_at: String,
}

// Profile Management structures (Proposal 2)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Household {
    pub id: String,
    pub name: String,
    pub primary_person_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Person {
    pub id: String,
    pub household_id: String,
    pub name: String,
    pub relationship: String, // "primary", "spouse", "dependent"
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PiiValue {
    pub id: String,
    pub person_id: String,
    pub category: String,
    pub value_encrypted: Vec<u8>,
    pub source_document: Option<String>,
    pub confidence_score: f32,
    pub is_encrypted: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaxConcept {
    pub id: String,
    pub term: String,
    pub definition: String,
    pub context: String,
    pub cached_at: String,
}

pub fn get_db_path() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("com", "privateassistant", "Private Assistant") {
        let data_dir = proj_dirs.data_dir();
        fs::create_dir_all(data_dir).expect("Failed to create data directory");
        data_dir.join("assistant.db")
    } else {
        PathBuf::from("assistant.db")
    }
}

pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    // Create tables
    conn.execute_batch(r#"
        -- Settings table for app configuration
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Conversations table
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            persona_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            project_id TEXT,
            title TEXT NOT NULL,
            total_tokens_used INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            model_id TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            latency_ms INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        -- Personas table
        CREATE TABLE IF NOT EXISTS personas (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            voice_id TEXT NOT NULL,
            preferred_model_id TEXT NOT NULL,
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 2000,
            is_built_in INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            -- LLM Backend Configuration (Proposal 3)
            enable_local_anonymizer INTEGER DEFAULT 0,
            preferred_backend TEXT DEFAULT 'nebius',
            anonymization_mode TEXT DEFAULT 'none',
            local_ollama_model TEXT
        );

        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Personal contexts table
        CREATE TABLE IF NOT EXISTS personal_contexts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            token_count INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Conversation-Context junction table
        CREATE TABLE IF NOT EXISTS conversation_contexts (
            conversation_id TEXT NOT NULL,
            context_id TEXT NOT NULL,
            PRIMARY KEY (conversation_id, context_id),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (context_id) REFERENCES personal_contexts(id) ON DELETE CASCADE
        );

        -- PII Mappings table (Proposal 1: Anonymization)
        CREATE TABLE IF NOT EXISTS pii_mappings (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            pii_category TEXT NOT NULL,
            pii_value_encrypted BLOB NOT NULL,
            placeholder TEXT NOT NULL,
            is_encrypted INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        -- Households table (Proposal 2: Profile Management)
        CREATE TABLE IF NOT EXISTS households (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            primary_person_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Persons table (Proposal 2)
        CREATE TABLE IF NOT EXISTS persons (
            id TEXT PRIMARY KEY,
            household_id TEXT NOT NULL,
            name TEXT NOT NULL,
            relationship TEXT DEFAULT 'primary',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
        );

        -- PII Values table (Proposal 2)
        CREATE TABLE IF NOT EXISTS pii_values (
            id TEXT PRIMARY KEY,
            person_id TEXT NOT NULL,
            category TEXT NOT NULL,
            value_encrypted BLOB NOT NULL,
            source_document TEXT,
            confidence_score REAL DEFAULT 1.0,
            is_encrypted INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
        );

        -- Tax Concepts cache table (Proposal 2)
        CREATE TABLE IF NOT EXISTS tax_concepts (
            id TEXT PRIMARY KEY,
            term TEXT NOT NULL UNIQUE,
            definition TEXT NOT NULL,
            context TEXT DEFAULT 'Dutch Tax Code',
            cached_at TEXT NOT NULL
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pii_mappings_conversation ON pii_mappings(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_persons_household ON persons(household_id);
        CREATE INDEX IF NOT EXISTS idx_pii_values_person ON pii_values(person_id);
        CREATE INDEX IF NOT EXISTS idx_tax_concepts_term ON tax_concepts(term);
    "#)?;

    Ok(conn)
}

/// Run migrations for new features
/// This handles adding new columns to existing databases without breaking them
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Migration: Add persona LLM backend configuration columns
    // This is safe to run multiple times (IF NOT EXISTS or PRAGMA table_info check)
    conn.execute_batch(r#"
        -- Add LLM backend config columns to personas if they don't exist
        -- SQLite doesn't have IF NOT EXISTS for columns, so we use a helper
        PRAGMA foreign_keys = OFF;
    "#)?;

    // Check if columns exist by trying to query them (safe approach for SQLite)
    let column_check = conn.query_row(
        "PRAGMA table_info(personas)",
        [],
        |_| Ok(()),
    );

    // Try to add columns if they don't exist
    // We use conditional logic: if column exists, query won't fail
    let _ = conn.execute(
        "ALTER TABLE personas ADD COLUMN enable_local_anonymizer INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE personas ADD COLUMN preferred_backend TEXT DEFAULT 'nebius'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE personas ADD COLUMN anonymization_mode TEXT DEFAULT 'none'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE personas ADD COLUMN local_ollama_model TEXT",
        [],
    );

    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(())
}

// Settings operations
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
    let mut rows = stmt.query([key])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        params![key, value],
    )?;
    Ok(())
}

// Conversation operations
pub fn create_conversation(conn: &Connection, conv: &Conversation) -> Result<()> {
    conn.execute(
        "INSERT INTO conversations (id, persona_id, model_id, project_id, title, total_tokens_used, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            conv.id,
            conv.persona_id,
            conv.model_id,
            conv.project_id,
            conv.title,
            conv.total_tokens_used,
            conv.created_at,
            conv.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_conversations(conn: &Connection) -> Result<Vec<Conversation>> {
    let mut stmt = conn.prepare(
        "SELECT id, persona_id, model_id, project_id, title, total_tokens_used, created_at, updated_at
         FROM conversations ORDER BY updated_at DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            persona_id: row.get(1)?,
            model_id: row.get(2)?,
            project_id: row.get(3)?,
            title: row.get(4)?,
            total_tokens_used: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    rows.collect()
}

pub fn delete_conversation(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM conversations WHERE id = ?", [id])?;
    Ok(())
}

// Message operations
pub fn add_message(conn: &Connection, msg: &Message) -> Result<()> {
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, model_id, input_tokens, output_tokens, latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            msg.id,
            msg.conversation_id,
            msg.role,
            msg.content,
            msg.model_id,
            msg.input_tokens,
            msg.output_tokens,
            msg.latency_ms,
            msg.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, model_id, input_tokens, output_tokens, latency_ms, created_at
         FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )?;

    let rows = stmt.query_map([conversation_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            model_id: row.get(4)?,
            input_tokens: row.get(5)?,
            output_tokens: row.get(6)?,
            latency_ms: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    rows.collect()
}

// Persona operations
pub fn create_persona(conn: &Connection, persona: &Persona) -> Result<()> {
    conn.execute(
        "INSERT INTO personas (id, name, description, system_prompt, voice_id, preferred_model_id, temperature, max_tokens, is_built_in, created_at, updated_at, enable_local_anonymizer, preferred_backend, anonymization_mode, local_ollama_model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            persona.id,
            persona.name,
            persona.description,
            persona.system_prompt,
            persona.voice_id,
            persona.preferred_model_id,
            persona.temperature,
            persona.max_tokens,
            persona.is_built_in as i32,
            persona.created_at,
            persona.updated_at,
            persona.enable_local_anonymizer as i32,
            persona.preferred_backend,
            persona.anonymization_mode,
            persona.local_ollama_model,
        ],
    )?;
    Ok(())
}

pub fn get_personas(conn: &Connection) -> Result<Vec<Persona>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, system_prompt, voice_id, preferred_model_id, temperature, max_tokens, is_built_in, created_at, updated_at, enable_local_anonymizer, preferred_backend, anonymization_mode, local_ollama_model
         FROM personas ORDER BY is_built_in DESC, name ASC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Persona {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            system_prompt: row.get(3)?,
            voice_id: row.get(4)?,
            preferred_model_id: row.get(5)?,
            temperature: row.get(6)?,
            max_tokens: row.get(7)?,
            is_built_in: row.get::<_, i32>(8)? != 0,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            enable_local_anonymizer: row.get::<_, i32>(11)? != 0,
            preferred_backend: row.get(12)?,
            anonymization_mode: row.get(13)?,
            local_ollama_model: row.get(14)?,
        })
    })?;

    rows.collect()
}

pub fn delete_persona(conn: &Connection, id: &str) -> Result<()> {
    // Don't delete built-in personas
    conn.execute("DELETE FROM personas WHERE id = ? AND is_built_in = 0", [id])?;
    Ok(())
}

pub fn update_persona(conn: &Connection, persona: &Persona) -> Result<()> {
    conn.execute(
        "UPDATE personas SET name = ?, description = ?, system_prompt = ?, voice_id = ?, preferred_model_id = ?, temperature = ?, max_tokens = ?, enable_local_anonymizer = ?, preferred_backend = ?, anonymization_mode = ?, local_ollama_model = ?, updated_at = ? WHERE id = ?",
        params![
            persona.name,
            persona.description,
            persona.system_prompt,
            persona.voice_id,
            persona.preferred_model_id,
            persona.temperature,
            persona.max_tokens,
            persona.enable_local_anonymizer as i32,
            persona.preferred_backend,
            persona.anonymization_mode,
            persona.local_ollama_model,
            persona.updated_at,
            persona.id,
        ],
    )?;
    Ok(())
}

// Project operations
pub fn create_project(conn: &Connection, project: &Project) -> Result<()> {
    conn.execute(
        "INSERT INTO projects (id, name, description, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![
            project.id,
            project.name,
            project.description,
            project.color,
            project.created_at,
            project.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, color, created_at, updated_at
         FROM projects ORDER BY name ASC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    rows.collect()
}

pub fn delete_project(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM projects WHERE id = ?", [id])?;
    Ok(())
}

// Personal context operations
pub fn create_context(conn: &Connection, ctx: &PersonalContext) -> Result<()> {
    conn.execute(
        "INSERT INTO personal_contexts (id, name, content, token_count, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            ctx.id,
            ctx.name,
            ctx.content,
            ctx.token_count,
            ctx.is_default as i32,
            ctx.created_at,
            ctx.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_contexts(conn: &Connection) -> Result<Vec<PersonalContext>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, token_count, is_default, created_at, updated_at
         FROM personal_contexts ORDER BY name ASC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(PersonalContext {
            id: row.get(0)?,
            name: row.get(1)?,
            content: row.get(2)?,
            token_count: row.get(3)?,
            is_default: row.get::<_, i32>(4)? != 0,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn delete_context(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM personal_contexts WHERE id = ?", [id])?;
    Ok(())
}

// PII Mapping operations (Proposal 1)
pub fn store_pii_mapping(conn: &Connection, mapping: &PiiMapping) -> Result<()> {
    conn.execute(
        "INSERT INTO pii_mappings (id, conversation_id, pii_category, pii_value_encrypted, placeholder, is_encrypted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            mapping.id,
            mapping.conversation_id,
            mapping.pii_category,
            mapping.pii_value_encrypted.as_slice(),
            mapping.placeholder,
            mapping.is_encrypted as i32,
            mapping.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_pii_mappings_for_conversation(conn: &Connection, conversation_id: &str) -> Result<Vec<PiiMapping>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, pii_category, pii_value_encrypted, placeholder, is_encrypted, created_at
         FROM pii_mappings WHERE conversation_id = ?"
    )?;

    let rows = stmt.query_map([conversation_id], |row| {
        Ok(PiiMapping {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            pii_category: row.get(2)?,
            pii_value_encrypted: row.get(3)?,
            placeholder: row.get(4)?,
            is_encrypted: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn clear_conversation_pii(conn: &Connection, conversation_id: &str) -> Result<()> {
    conn.execute("DELETE FROM pii_mappings WHERE conversation_id = ?", [conversation_id])?;
    Ok(())
}

// Household operations (Proposal 2)
pub fn create_household(conn: &Connection, household: &Household) -> Result<()> {
    conn.execute(
        "INSERT INTO households (id, name, primary_person_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![
            household.id,
            household.name,
            household.primary_person_id,
            household.created_at,
            household.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_households(conn: &Connection) -> Result<Vec<Household>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, primary_person_id, created_at, updated_at
         FROM households ORDER BY created_at DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Household {
            id: row.get(0)?,
            name: row.get(1)?,
            primary_person_id: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;

    rows.collect()
}

// Person operations (Proposal 2)
pub fn create_person(conn: &Connection, person: &Person) -> Result<()> {
    conn.execute(
        "INSERT INTO persons (id, household_id, name, relationship, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![
            person.id,
            person.household_id,
            person.name,
            person.relationship,
            person.created_at,
            person.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_persons_in_household(conn: &Connection, household_id: &str) -> Result<Vec<Person>> {
    let mut stmt = conn.prepare(
        "SELECT id, household_id, name, relationship, created_at, updated_at
         FROM persons WHERE household_id = ? ORDER BY created_at ASC"
    )?;

    let rows = stmt.query_map([household_id], |row| {
        Ok(Person {
            id: row.get(0)?,
            household_id: row.get(1)?,
            name: row.get(2)?,
            relationship: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    rows.collect()
}

// PII Value operations (Proposal 2)
pub fn add_pii_value(conn: &Connection, pii_value: &PiiValue) -> Result<()> {
    conn.execute(
        "INSERT INTO pii_values (id, person_id, category, value_encrypted, source_document, confidence_score, is_encrypted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            pii_value.id,
            pii_value.person_id,
            pii_value.category,
            pii_value.value_encrypted.as_slice(),
            pii_value.source_document,
            pii_value.confidence_score,
            pii_value.is_encrypted as i32,
            pii_value.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_pii_values_for_person(conn: &Connection, person_id: &str) -> Result<Vec<PiiValue>> {
    let mut stmt = conn.prepare(
        "SELECT id, person_id, category, value_encrypted, source_document, confidence_score, is_encrypted, created_at
         FROM pii_values WHERE person_id = ?"
    )?;

    let rows = stmt.query_map([person_id], |row| {
        Ok(PiiValue {
            id: row.get(0)?,
            person_id: row.get(1)?,
            category: row.get(2)?,
            value_encrypted: row.get(3)?,
            source_document: row.get(4)?,
            confidence_score: row.get(5)?,
            is_encrypted: row.get::<_, i32>(6)? != 0,
            created_at: row.get(7)?,
        })
    })?;

    rows.collect()
}

// Tax Concepts operations (Proposal 2)
pub fn cache_tax_concept(conn: &Connection, concept: &TaxConcept) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO tax_concepts (id, term, definition, context, cached_at)
         VALUES (?, ?, ?, ?, ?)",
        params![
            concept.id,
            concept.term,
            concept.definition,
            concept.context,
            concept.cached_at,
        ],
    )?;
    Ok(())
}

pub fn get_tax_concept(conn: &Connection, term: &str) -> Result<Option<TaxConcept>> {
    let mut stmt = conn.prepare(
        "SELECT id, term, definition, context, cached_at
         FROM tax_concepts WHERE term = ?"
    )?;

    let mut rows = stmt.query([term])?;

    if let Some(row) = rows.next()? {
        Ok(Some(TaxConcept {
            id: row.get(0)?,
            term: row.get(1)?,
            definition: row.get(2)?,
            context: row.get(3)?,
            cached_at: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

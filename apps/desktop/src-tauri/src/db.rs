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
            updated_at TEXT NOT NULL
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

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    "#)?;

    Ok(conn)
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
        "INSERT INTO personas (id, name, description, system_prompt, voice_id, preferred_model_id, temperature, max_tokens, is_built_in, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        ],
    )?;
    Ok(())
}

pub fn get_personas(conn: &Connection) -> Result<Vec<Persona>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, system_prompt, voice_id, preferred_model_id, temperature, max_tokens, is_built_in, created_at, updated_at
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
        })
    })?;

    rows.collect()
}

pub fn delete_persona(conn: &Connection, id: &str) -> Result<()> {
    // Don't delete built-in personas
    conn.execute("DELETE FROM personas WHERE id = ? AND is_built_in = 0", [id])?;
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

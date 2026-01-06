use crate::db::{self, Conversation, Message, Persona, Project, PersonalContext};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

pub struct DbState(pub Mutex<Connection>);

// Error handling
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Lock error")]
    Lock,
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type Result<T> = std::result::Result<T, CommandError>;

// Settings commands
#[tauri::command]
pub fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_setting(&conn, &key).map_err(CommandError::from)
}

#[tauri::command]
pub fn set_setting(state: State<DbState>, key: String, value: String) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::set_setting(&conn, &key, &value).map_err(CommandError::from)
}

// Conversation commands
#[tauri::command]
pub fn create_conversation(state: State<DbState>, conversation: Conversation) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::create_conversation(&conn, &conversation).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_conversations(state: State<DbState>) -> Result<Vec<Conversation>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_conversations(&conn).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_conversation(state: State<DbState>, id: String) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::delete_conversation(&conn, &id).map_err(CommandError::from)
}

// Message commands
#[tauri::command]
pub fn add_message(state: State<DbState>, message: Message) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::add_message(&conn, &message).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_messages(state: State<DbState>, conversation_id: String) -> Result<Vec<Message>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_messages(&conn, &conversation_id).map_err(CommandError::from)
}

// Persona commands
#[tauri::command]
pub fn create_persona(state: State<DbState>, persona: Persona) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::create_persona(&conn, &persona).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_personas(state: State<DbState>) -> Result<Vec<Persona>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_personas(&conn).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_persona(state: State<DbState>, id: String) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::delete_persona(&conn, &id).map_err(CommandError::from)
}

// Project commands
#[tauri::command]
pub fn create_project(state: State<DbState>, project: Project) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::create_project(&conn, &project).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_projects(state: State<DbState>) -> Result<Vec<Project>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_projects(&conn).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_project(state: State<DbState>, id: String) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::delete_project(&conn, &id).map_err(CommandError::from)
}

// Context commands
#[tauri::command]
pub fn create_context(state: State<DbState>, context: PersonalContext) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::create_context(&conn, &context).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_contexts(state: State<DbState>) -> Result<Vec<PersonalContext>> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::get_contexts(&conn).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_context(state: State<DbState>, id: String) -> Result<()> {
    let conn = state.0.lock().map_err(|_| CommandError::Lock)?;
    db::delete_context(&conn, &id).map_err(CommandError::from)
}

// Utility commands
#[tauri::command]
pub fn get_db_path() -> String {
    db::get_db_path().to_string_lossy().to_string()
}

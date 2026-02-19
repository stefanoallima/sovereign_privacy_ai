mod db;
mod commands;
mod tts;
mod tts_commands;
mod stt;
mod stt_commands;
mod inference;
mod ollama;
mod inference_commands;
mod llama_backend;
mod crypto;
mod anonymization;
mod anonymization_commands;
mod file_parsers;
mod entity_resolver;
mod profiles;
mod tax_knowledge;
mod profile_commands;
mod backend_routing;
mod backend_routing_commands;
mod attribute_extraction;
mod attribute_extraction_commands;
mod rehydration;
mod rehydration_commands;
mod gliner;
mod gliner_commands;

use commands::DbState;
use tts::PiperTts;
use tts_commands::TtsState;
use stt::WhisperStt;
use stt_commands::SttState;
use inference::LocalInference;
use inference_commands::InferenceState;
use ollama::OllamaClient;
use llama_backend::LlamaCppBackend;
use crypto::EncryptionKeyManager;
use anonymization::AnonymizationService;
use anonymization_commands::AnonymizationState;
use tax_knowledge::TaxKnowledgeBase;
use backend_routing_commands::BackendRoutingState;
use attribute_extraction::AttributeExtractor;
use attribute_extraction_commands::AttributeExtractionState;
use gliner::GlinerBackend;
use gliner_commands::GlinerState;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Private Assistant")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_global_shortcuts<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Register Ctrl+Space for voice recording
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut_event, event| {
                if shortcut_event == &shortcut {
                    match event.state {
                        ShortcutState::Pressed => {
                            // Emit event to frontend to start recording
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("voice-shortcut-pressed", ());
                            }
                        }
                        ShortcutState::Released => {
                            // Emit event to frontend to stop recording
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("voice-shortcut-released", ());
                            }
                        }
                    }
                }
            })
            .build(),
    )?;

    // Register the shortcut
    app.global_shortcut().register(shortcut)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let conn = db::init_db().expect("Failed to initialize database");

    // Run migrations
    db::run_migrations(&conn).expect("Failed to run database migrations");

    // Initialize TTS
    let tts = PiperTts::new().expect("Failed to initialize TTS");

    // Initialize STT
    let stt = WhisperStt::new().expect("Failed to initialize STT");

    // Initialize inference backend
    // Use AILOCALMIND_USE_OLLAMA=1 env var to fall back to Ollama (for development)
    let inference: Arc<dyn LocalInference> = if std::env::var("AILOCALMIND_USE_OLLAMA").unwrap_or_default() == "1" {
        eprintln!("Using Ollama backend (AILOCALMIND_USE_OLLAMA=1)");
        Arc::new(OllamaClient::new(None, None))
    } else {
        match LlamaCppBackend::new() {
            Ok(backend) => {
                eprintln!("Using embedded llama.cpp backend");
                Arc::new(backend)
            }
            Err(e) => {
                eprintln!("Failed to initialize llama.cpp backend: {}, falling back to Ollama", e);
                Arc::new(OllamaClient::new(None, None))
            }
        }
    };

    // Initialize encryption key manager
    let encryption_key = EncryptionKeyManager::new()
        .unwrap_or_else(|e| {
            eprintln!("Failed to initialize encryption key manager: {}", e);
            eprintln!("PII encryption will not be available");
            panic!("Critical: encryption key manager failed");
        });

    // Initialize anonymization service
    let anonymization = AnonymizationService::new()
        .unwrap_or_else(|e| {
            eprintln!("Failed to initialize anonymization service: {}", e);
            panic!("Critical: anonymization service failed");
        });

    // Initialize tax knowledge base
    let tax_knowledge = TaxKnowledgeBase::new();

    // Initialize GLiNER backend for PII detection
    let gliner_backend = GlinerBackend::new()
        .unwrap_or_else(|e| {
            eprintln!("Failed to initialize GLiNER backend: {}", e);
            panic!("Critical: GLiNER backend failed");
        });
    let gliner_state = GlinerState(Arc::new(tokio::sync::Mutex::new(gliner_backend)));

    // Initialize backend routing state (shares inference backend)
    let backend_routing = BackendRoutingState {
        inference: inference.clone(),
    };

    // Initialize attribute extraction state (shares inference backend)
    let attribute_extraction = AttributeExtractionState {
        inference: inference.clone(),
        extractor: AttributeExtractor::new(),
    };

    // Wrap inference in state for Tauri commands
    let inference_state = InferenceState(Arc::new(tokio::sync::Mutex::new(inference)));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(Mutex::new(conn)))
        .manage(TtsState(Mutex::new(tts)))
        .manage(SttState(Mutex::new(stt)))
        .manage(inference_state)
        .manage(Mutex::new(encryption_key))
        .manage(AnonymizationState(Mutex::new(anonymization)))
        .manage(Mutex::new(tax_knowledge))
        .manage(tokio::sync::Mutex::new(backend_routing))
        .manage(tokio::sync::Mutex::new(attribute_extraction))
        .manage(gliner_state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::get_setting,
            commands::set_setting,
            // Conversations
            commands::create_conversation,
            commands::get_conversations,
            commands::delete_conversation,
            // Messages
            commands::add_message,
            commands::get_messages,
            // Personas
            commands::create_persona,
            commands::get_personas,
            commands::delete_persona,
            // Projects
            commands::create_project,
            commands::get_projects,
            commands::delete_project,
            // Contexts
            commands::create_context,
            commands::get_contexts,
            commands::delete_context,
            // Utility
            commands::get_db_path,
            // TTS
            tts_commands::tts_get_status,
            tts_commands::tts_initialize,
            tts_commands::tts_speak,
            tts_commands::tts_stop,
            tts_commands::tts_is_speaking,
            tts_commands::tts_set_voice,
            tts_commands::tts_download_voice,
            // STT
            stt_commands::stt_get_status,
            stt_commands::stt_initialize,
            stt_commands::stt_transcribe,
            stt_commands::stt_is_transcribing,
            stt_commands::stt_set_config,
            stt_commands::stt_download_model,
            // Inference (backward-compatible command names + new commands)
            inference_commands::ollama_is_available,
            inference_commands::extract_pii_from_document,
            inference_commands::ollama_generate,
            inference_commands::ollama_pull_model,
            inference_commands::ollama_initialize,
            inference_commands::get_model_status,
            inference_commands::download_default_model,
            // Anonymization
            anonymization_commands::anonymize_text,
            anonymization_commands::validate_anonymization,
            // File Parsers & Profile Management
            profile_commands::parse_document,
            profile_commands::find_person_matches,
            profile_commands::should_create_new_person_command,
            profile_commands::mask_pii_for_display,
            // Tax Knowledge
            profile_commands::analyze_accountant_request,
            profile_commands::get_tax_concept,
            profile_commands::list_tax_concepts,
            // Backend Routing
            backend_routing_commands::make_backend_routing_decision,
            backend_routing_commands::validate_persona_backend_config,
            backend_routing_commands::check_ollama_availability,
            backend_routing_commands::get_available_ollama_models,
            // Attribute Extraction (Privacy-First)
            attribute_extraction_commands::extract_tax_attributes,
            attribute_extraction_commands::generate_privacy_safe_prompt,
            attribute_extraction_commands::process_chat_with_privacy,
            attribute_extraction_commands::extract_question,
            // Re-hydration (Template Filling)
            rehydration_commands::analyze_template_command,
            rehydration_commands::rehydrate_template_command,
            rehydration_commands::build_template_prompt_command,
            rehydration_commands::get_placeholder_types,
            // GLiNER PII Detection
            gliner_commands::list_gliner_models,
            gliner_commands::download_gliner_model,
            gliner_commands::get_gliner_download_progress,
            gliner_commands::delete_gliner_model,
            gliner_commands::get_gliner_models_dir,
            gliner_commands::detect_pii_with_gliner,
        ])
        .setup(|app| {
            // Set up system tray
            setup_tray(app)?;

            // Set up global shortcuts
            if let Err(e) = setup_global_shortcuts(app) {
                eprintln!("Failed to setup global shortcuts: {}", e);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

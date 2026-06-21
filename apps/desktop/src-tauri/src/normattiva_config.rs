//! Normattiva brand configuration (only compiled when the `normattiva` feature
//! is enabled).
//!
//! Sovereign is the default build flavor; this module only exists in the
//! Normattiva build. It exposes compile-time defaults that the Tauri
//! `load_default_personas` command reads at first launch so the user has a
//! working `legal-advisor-it` persona out of the box.

#[cfg(feature = "normattiva")]
pub const BRAND: &str = "normattiva";

#[cfg(feature = "normattiva")]
pub const DEFAULT_PERSONA_ID: &str = "legal-advisor-it";

#[cfg(feature = "normattiva")]
pub const DEFAULT_PERSONA_NAME: &str = "Consulente Legale";

#[cfg(feature = "normattiva")]
pub const DEFAULT_PERSONA_DESCRIPTION: &str =
    "Consulenza legale italiana con riferimenti normattivi via NLP Cloud.";

#[cfg(feature = "normattiva")]
pub const DEFAULT_MODEL_ID: &str = "normattiva-legal-pro";

#[cfg(feature = "normattiva")]
pub const DEFAULT_CLOUD_BACKEND: &str = "normattiva";

#[cfg(feature = "normattiva")]
pub const DEFAULT_API_ENDPOINT: &str = "https://api.normattiva.ai/v1";

#[cfg(feature = "normattiva")]
pub const LEGAL_DISCLAIMER_TEXT: &str = "Questo strumento è un ausilio alla ricerca giuridica, non sostituisce il parere di un professionista abilitato. Verifica sempre le fonti.";

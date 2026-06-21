//! Brand identity constants, always compiled.
//!
//! In the default (Sovereign) build, `BRAND = "sovereign"`. When the
//! `normattiva` cargo feature is enabled, `BRAND = "normattiva"` (overridden
//! by the `normattiva_config` module, which is also feature-gated).
//!
//! Most brand-specific configuration (persona defaults, model defaults,
//! endpoint URLs) lives in the TS layer at apps/desktop/src/config/defaults.ts
//! and is baked at build time by `scripts/build-brand.mjs`. This constant is
//! a single source of truth for "which build is this" in the Rust binary.

#[cfg(not(feature = "normattiva"))]
pub const BRAND: &str = "sovereign";

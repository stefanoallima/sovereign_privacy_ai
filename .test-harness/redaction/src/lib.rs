//! Offline test harness for the self-contained `redaction` module.
//!
//! Includes `redaction.rs` directly via `#[path]` so its `#[cfg(test)]` tests
//! run with `cargo test --offline` here WITHOUT compiling the full Tauri crate
//! (which would build llama.cpp / CUDA). The module depends only on
//! `regex` + `serde` + `std`, so this thin shim is all it needs.
#[path = "../../../apps/desktop/src-tauri/src/redaction.rs"]
pub mod redaction;

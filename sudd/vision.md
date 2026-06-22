# Vision: Sovereign AI — Private Personal Assistant

## North Star

## What We're Building
A desktop application (Tauri 2 + React + Rust) that gives individuals a private AI advisor for sensitive life domains — tax, legal, financial, health, career, and more — where personal data never reaches cloud LLMs unless explicitly approved and anonymized. It runs on Windows and macOS Apple Silicon and supports both fully local (llama.cpp embedded) and cloud-routed-with-redaction modes.

## Problem
People routinely share sensitive personal information — health symptoms, financial details, family situations — with cloud AI services whose data practices they cannot control. These services use prompts for training, profiling, and advertising. There is no mainstream AI assistant that lets someone get high-quality advice on personal matters while keeping raw PII entirely on-device.

## Target Users
Privacy-conscious individuals who want substantive AI help with personal decisions (taxes, legal questions, health, investments) but are not willing to surrender that data to cloud providers. Deal-breakers: raw PII hitting any server they don't control, no transparency about what is sent, no local-only fallback.

## Success Looks Like
A user asks the Tax Navigator about their financial situation, and the cloud only ever sees categorical attributes ("income bracket: 50k-75k") with real values filled back in locally. A user in Local Mode gets full responses with zero outbound network calls. The Prompt Transparency Review panel shows exactly what the cloud would receive before anything is sent.

## Key Constraints
- Stack: Tauri 2 desktop shell, React 19 + TypeScript frontend, Rust backend; embedded llama.cpp for local inference; GLiNER via ONNX Runtime for on-device PII detection; ChaCha20-Poly1305 encryption
- Default cloud provider: Nebius Token Factory (EU-based, Zero Data Retention opt-in); configurable to any OpenAI-compatible endpoint
- 14 specialist advisor personas ("Sovereign Council"), each with independent privacy settings and LLM backend selection
- PII redaction pipeline: detect (GLiNER) → anonymize to categorical attributes → prompt review → cloud call → re-hydrate locally; raw values never transmitted
- Platforms: Windows (x64) and macOS Apple Silicon; CI builds are unsigned (no Apple signing cert configured)

## Current Path

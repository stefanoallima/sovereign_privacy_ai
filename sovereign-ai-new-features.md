# Sovereign AI — New Features Brief

## The Two Problems to Solve

**Problem 1: Too much manual context feeding**
The app currently requires the user to manually provide personal context to be useful. Without knowing your relationships, history, and communication style, it cannot offer meaningful assistance.

**Problem 2: Too device-local**
Living only on desktop means it is disconnected from where 90% of personal life happens — the phone. No continuity across devices kills daily habit formation.

---

## New Features That Fix This

### 1. WhatsApp Backup Consumption
Import your WhatsApp backup locally. The app reads your conversation history, relationship context, and communication patterns — all processed on-device, never uploaded. This is the single biggest source of personal context that no cloud AI can access. Turns years of real conversations into app intelligence without any privacy tradeoff.

### 2. Gmail OAuth Integration *(optional)*
Optionally connect Gmail to read your inbox and create drafts directly. The app drafts replies using your full context — WhatsApp history, email threads, contact knowledge — and places them in Gmail as drafts. You review and send. The app never sends on your behalf. Users who prefer not to connect Gmail can still use all other features fully.

### 3. Google Drive Sync
Encrypted sync of conversation history, settings, and personal context across devices. Your phone and desktop share the same knowledge base via Drive. No Sovereign AI server is involved — Drive is just an encrypted transport layer.

### 4. Mobile App
Cross-platform mobile app via Capacitor. Same React UI as desktop. Connects to your context via Google Drive sync. Voice interface adapted for mobile. This is what turns the app from a desktop experiment into something you actually reach for daily.

### 5. ChatGPT Memory Import
Import your ChatGPT conversation history and memory exports. Migrates personal context you have already built elsewhere into your local vault. Useful for users leaving ChatGPT due to privacy concerns or data retention policies.

---

## What This Unlocks

Once these features are in place the app stops requiring manual context feeding — it already knows your relationships, your voice, your history. And it follows you across devices rather than being anchored to one machine.

The result is a personal assistant that is genuinely ready to use without setup friction on any given day.

---

## What Stays Out of Scope (For Now)

- OpenClaw privacy shield integration (later)
- Compliance and audit features (enterprise tier, later)
- Autonomous sending or account key management (never — human always sends)

---

## PII Redaction — Free Tier Includes GLiNER

GLiNER advanced PII detection ships in the free version. It is a core part of the privacy promise and should not be paywalled. The quality gap between regex-only and GLiNER detection is too significant to hide behind a subscription.

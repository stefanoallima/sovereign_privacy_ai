# Persona: Margot — Legal Advisor

## Identity
- **Name:** Margot
- **Role:** Solo legal advisor / contract reviewer
- **Tech comfort:** Intermediate (comfortable with desktop apps, understands privacy controls)
- **Context:** Reviews sensitive client contracts and legal documents; needs privacy assurance to maintain client confidentiality
- **Primary device:** Desktop (Windows/macOS)

## Objectives
1. **Use Incognito Mode for contract reviews** — Enable Incognito conversation when analyzing client contracts so that no trace of the conversation (including meta-data or message history) persists locally
   - Success criteria: Proof that chat is not in IndexedDB after app closes/reopens
   - Measurable: Run DevTools, inspect IndexedDB, confirm Incognito chat deleted
2. **Trust the privacy implementation** — See a clear visual indicator (e.g., 🕵️ badge) that Incognito Mode is active so she knows she's in the correct privacy mode
   - Success criteria: Badge appears in chat header and sidebar when Incognito is enabled
   - Measurable: Visual inspection; screenshot verification
3. **Quickly switch Incognito on/off per chat** — Toggle Incognito without reopening the app or changing settings
   - Success criteria: Per-chat toggle visible in Sidebar
   - Measurable: Click toggle, see visual change in <1 second
4. **Maintain normal functionality while in Incognito** — Get PII redaction, prompt review, and cloud responses just like normal chats
   - Success criteria: Incognito chat processes the same way as normal; only storage is different
   - Measurable: Use Incognito chat, see prompt review modal, get response from cloud LLM

## Deal-Breakers
1. **Raw contract text or client names appear in app storage** — If IndexedDB or localStorage contains any chat content after closing an Incognito conversation, Margot will not trust the app
2. **Incognito indicator is unclear or easy to miss** — If she can't easily verify she's in Incognito mode, she risks using normal mode for sensitive work
3. **Incognito mode disables security features** — If Incognito mode skips PII redaction or prompt review, Margot will not use it (she wants both privacy + security)

## Mental Model
- "Incognito is like my browser's incognito mode — conversation disappears after I close the tab"
- "But unlike browser incognito, this still redacts my PII and shows me what's being sent to the cloud (I still control what's shared)"
- "I use this for sensitive client contracts; I need zero trace left behind when I'm done"

## Success Criteria (End-to-End)
- [x] Open app
- [x] Create a new chat and toggle Incognito ON
- [x] See 🕵️ badge in header + sidebar
- [x] Send a message (e.g., "Review this contract clause: ...") with sensitive details
- [x] See prompt review modal (PII redaction still works)
- [x] Get response from cloud LLM
- [x] Close app
- [x] Reopen app
- [x] Verify that Incognito chat is GONE from history
- [x] Verify that chat is NOT in IndexedDB (dev tools inspection)
- [x] Create normal chat, verify it persists after close/reopen

## Form Data (if applicable)
_No forms in this feature; Margot interacts with chat sidebar and toggles._

## Failure Modes (What Could Go Wrong)
1. Incognito chat is saved to IndexedDB despite toggle being ON → Margot loses trust
2. Incognito toggle is hidden or hard to find → Margot uses normal mode by accident
3. Incognito mode skips PII redaction → Margot's client data is sent unredacted
4. App crashes or closes unexpectedly → Incognito chat might be partially persisted

## Validation Checklist
- [ ] Can toggle Incognito on per-chat
- [ ] Incognito badge visible in header
- [ ] Incognito chat not persisted after app close/reopen
- [ ] DevTools confirms IndexedDB doesn't contain Incognito chat
- [ ] PII redaction still works in Incognito mode
- [ ] Prompt review modal appears in Incognito chat
- [ ] Cloud response received in Incognito chat
- [ ] Can toggle Incognito off mid-conversation (if supported)
- [ ] Settings option for "Default to Incognito" works

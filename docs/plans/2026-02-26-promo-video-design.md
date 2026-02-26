# Sovereign AI — Promotional Video Design
**Date:** 2026-02-26
**Approach:** Pure Remotion (React-based programmatic video, no screen recordings)
**Target:** Website hero embed
**Duration:** 60 seconds · 30fps · 1800 frames · 1920×1080 16:9

---

## Creative Direction

**Narrative arc:** Threat → Turn → Proof → CTA
**Tone:** Tech-noir, calm authority. Not aggressive. Confident.
**Color palette:**
- Background: `#0a0a0f`
- Accent/brand: `#6c63ff` (purple)
- Danger: `#ef4444` (red)
- Safe/local: `#22c55e` (green)
- Cloud/muted: `#6b7280` (grey)
- Text primary: `#f8fafc`
- Text muted: `#94a3b8`

**Typography:** `Inter` (system-ui fallback). Weights 400, 600, 700.

**Music:** Minimalist ambient/cyber-industrial. Steady pulse. ~60bpm.
**Voiceover:** ElevenLabs "Marcus" or "Brian" — deep, calm, tech-noir register.

---

## Scene Breakdown

### Scene 1 — The Threat (frames 0–150, 0–5s)
**Visual:**
- Black screen fades in
- Fake browser chat UI (generic "cloud AI" aesthetic — light theme, rounded input)
- Text types character-by-character: *"My salary is €62,500, BSN: 123-456-789, I have a mortgage on Keizersgracht 42..."*
- As sensitive tokens appear, red glow pulses beneath them (`box-shadow` animation)
- Full-width banner sweeps right→left: **"TRANSMITTED TO SERVER"** in cold red
- Sub-label: *"permanent record · training data · ad targeting"*

**Voiceover:** *"Every prompt you send to cloud AI is a permanent record. Your salary. Your health. Your secrets. They become training data."*

**Key animations:**
- `useCurrentFrame()` typewriter: 1 char per 2 frames
- Banner: `spring({ frame, fps, config: { stiffness: 80 } })` on `translateX`
- Sensitive token glow: `Math.sin(frame * 0.3) * 8` px blur oscillation

---

### Scene 2 — The Turn (frames 150–270, 5–9s)
**Visual:**
- Browser UI exits: `scale` 1→0.8 + `opacity` 1→0 over 10 frames, 3-frame white flash
- Sovereign AI shield logo materializes center-screen from converging particles (30 particles, radial inward motion)
- Logo settles with spring overshoot
- Tagline types in: *"Your data is yours. Not theirs."*

**Voiceover:** *"There's a sovereign alternative."*

**Key animations:**
- Particle system: each particle has random starting angle, travels inward over 40 frames
- Logo: `spring({ frame: frame - 20, fps, config: { stiffness: 60, damping: 12 } })` on scale
- Tagline typewriter starts at frame 60 of scene

---

### Scene 3 — The Council (frames 270–510, 9–17s)
**Visual:**
- 14 advisor cards in a 5-3-3-3 grid layout
- Cards stagger in: each card delays by `index * 8` frames, slides up 20px + fades in
- Each card: icon (emoji) + name (`@tax-navigator`) + privacy badge (LOCAL/HYBRID/CLOUD)
- Badge colors: LOCAL=green, HYBRID=purple, CLOUD=grey
- Purple sweep highlight across @tax-navigator and @health-coach cards

**Advisor list:**
`@psychologist`, `@life-coach`, `@career-coach`, `@tax-navigator`, `@tax-audit`, `@legal-advisor`, `@financial-advisor`, `@health-coach`, `@personal-branding`, `@social-media`, `@real-estate`, `@cybersecurity`, `@immigration`, `@investment`

**Voiceover:** *"Meet your private council. 14 specialized advisors — tax, legal, health, finance — each with independent privacy rules."*

---

### Scene 4 — The Pipeline Centerpiece (frames 510–870, 17–29s)
**Visual:** Six pipeline nodes animate in sequentially, connected by animated dotted lines. A glowing particle travels through them.

**Node layout (two rows):**
```
Row 1 (L→R): [Your Message] → [GLiNER Shield] → [Backend Router]
Row 2 (R→L):              [Rehydration] ← [Cloud LLM] ← [Attribute Extract]
```

**Node interactions as particle arrives:**
1. **GLiNER Shield** — particle flashes white, PII tokens in the message replace chars with `█` blocks, node glows green
2. **Attribute Extract** — particle splits; red path labeled `"BSN: 123..."` hits a barrier with `✕`; green path labeled `"income_bracket: 50k–75k"` continues
3. **Cloud LLM** — node pulses briefly, a small text bubble appears: *"Your [INCOME] falls in..."*
4. **Rehydration** — `[INCOME]` chars morph to `"€62,500"` with green flash, node labeled "local only"

**Key animations:**
- Dotted line draw: `strokeDashoffset` animation
- Particle: `interpolate(frame, [start, end], [0, pathLength])` along SVG path
- Text redaction: char-by-char replacement timed to particle arrival
- `[INCOME]` morph: cross-dissolve between placeholder and real value

**Voiceover:** *"Our privacy pipeline detects sensitive data locally before anything leaves your machine. The cloud sees only categories. Never your identity."*

---

### Scene 5 — Data Split (frames 870–1110, 29–37s)
**Visual:**
- Screen splits vertically with animated divider line
- Left panel (green tint): label **"What stays on your machine"** + lock icon
- Right panel (grey tint): label **"What the cloud sees"** + cloud icon

Left populates line by line (bright white):
```
Jan de Vries
BSN: 123-456-789
Salary: €62,500
Keizersgracht 42, Amsterdam
```

Right populates simultaneously (muted grey):
```
[PERSON]
[IDENTIFIER]
income_bracket: 50k–75k
[ADDRESS]
```

- Divider pulses purple
- Each line pair appears with 15-frame stagger

**Voiceover:** *"Powerful models get the context. You keep the identity."*

---

### Scene 6 — Local Mode Flex (frames 1110–1350, 37–45s)
**Visual:**
- Three pill buttons centered: **Local** · **Hybrid** · **Cloud**
- "Local" pill gets purple highlight with spring animation
- Wi-Fi icon with animated red strike-through fades in below
- Network monitor widget: `↑ 0 kbps` · `↓ 0 kbps` (stays at zero)
- Token generation stream starts: words appearing at ~80 tokens/sec visually

**Voiceover:** *"Switch to Local Mode and the model runs entirely on your hardware. Zero network requests. Zero trust required."*

---

### Scene 7 — Tech Stack Flash (frames 1350–1500, 45–50s)
**Visual:**
- Four badge pills stagger in (delay 12 frames each):
  - `Tauri 2` (cyan `#24C8DB`)
  - `Rust` (orange `#DEA584`)
  - `React 19` (blue `#61DAFB`)
  - `GLiNER` (purple `#6c63ff`)
- Each pulses once with its brand color glow
- Below: *"Open source · MIT License · Windows & macOS"* in muted text

**Voiceover:** *"Rust-powered. Open source. Built for people who refuse to trade their data for intelligence."*

---

### Scene 8 — CTA (frames 1500–1800, 50–60s)
**Visual:**
- Full dark screen, subtle particle field drifting slowly
- Sovereign AI shield logo centered, larger (1.4× Scene 2 size)
- Two buttons animate in with stagger:
  - **"Download Free"** — purple fill, white text
  - **"View on GitHub"** — transparent fill, purple border
- Tagline: *"Sovereign AI — Your data. Your rules."*
- Final 2 seconds: very slow zoom out, particles settle

**Voiceover:** *"Sovereign AI. Download free. Your data. Your rules."*

---

## Remotion Project Structure

```
video/
  src/
    Root.tsx                    # Remotion root, registers composition
    compositions/
      PromoVideo.tsx            # Main 1800-frame composition, sequences all scenes
    scenes/
      Scene1Threat.tsx
      Scene2Turn.tsx
      Scene3Council.tsx
      Scene4Pipeline.tsx
      Scene5DataSplit.tsx
      Scene6LocalMode.tsx
      Scene7TechStack.tsx
      Scene8CTA.tsx
    components/
      TypewriterText.tsx        # Reusable char-by-char text animator
      ParticleField.tsx         # Background particle system
      PipelineNode.tsx          # Single pipeline node with state animations
      PipelineParticle.tsx      # Traveling data particle
      AdvisorCard.tsx           # Council member card
      PrivacyBadge.tsx          # LOCAL/HYBRID/CLOUD badge
      ModeSelector.tsx          # Three-pill mode switcher
      TechBadge.tsx             # Tech stack badge pill
      BrowserMockup.tsx         # Fake cloud AI browser UI
      ShieldLogo.tsx            # Sovereign AI shield (SVG animated)
    hooks/
      useTypewriter.ts          # Frame-driven typewriter hook
    constants/
      advisors.ts               # 14 advisor data
      colors.ts                 # Brand color tokens
      timing.ts                 # Scene frame ranges
    audio/
      voiceover.mp3             # Drop-in voiceover (ElevenLabs)
      music.mp3                 # Background ambient track
  public/
    (static assets if needed)
  package.json
  remotion.config.ts
```

---

## Voiceover Script (full, timed)

| Time | Line |
|------|------|
| 0–5s | *"Every prompt you send to cloud AI is a permanent record. Your salary. Your health. Your secrets. They become training data."* |
| 5–9s | *"There's a sovereign alternative."* |
| 9–17s | *"Meet your private council. 14 specialized advisors — tax, legal, health, finance — each with independent privacy rules."* |
| 17–29s | *"Our privacy pipeline detects sensitive data locally before anything leaves your machine. The cloud sees only categories. Never your identity."* |
| 29–37s | *"Powerful models get the context. You keep the identity."* |
| 37–45s | *"Switch to Local Mode and the model runs entirely on your hardware. Zero network requests. Zero trust required."* |
| 45–50s | *"Rust-powered. Open source. Built for people who refuse to trade their data for intelligence."* |
| 50–60s | *"Sovereign AI. Download free. Your data. Your rules."* |

---

## Technical Notes

- **Remotion version:** 4.x (`@remotion/cli`, `@remotion/player` for website embed)
- **Font loading:** Use `@remotion/google-fonts` for Inter
- **Audio:** `<Audio>` component with volume envelope (music at 0.3, voiceover at 1.0)
- **Rendering:** `npx remotion render src/Root.tsx PromoVideo out/promo.mp4 --codec=h264`
- **Website embed:** Use `@remotion/player` as a React component directly in the site, or embed the rendered MP4 with autoplay/muted/loop for the hero
- **SVG paths:** Pipeline layout uses absolute SVG coordinates; particle motion uses `getPointAtLength()` on the path

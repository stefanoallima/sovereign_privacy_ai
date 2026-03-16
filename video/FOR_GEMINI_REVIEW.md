# Sovereign AI — Promo Video Style Review Request

## Context

We are building a **60-second promotional video** for **Sovereign AI** — a privacy-first desktop AI assistant (Tauri 2 + Rust + React, open source, MIT).

The video is built entirely in **Remotion 4.x** (React-based programmatic video, no screen recordings).

We have built a **10-second style preview** (`StylePreview.tsx`) to validate the visual aesthetic before committing to a full rebuild. This file contains 3 mini-scenes.

---

## The Product

**Sovereign AI** is a desktop app with 14 specialized AI advisors (@tax-navigator, @legal-advisor, @health-coach, etc.). Its core differentiator is a privacy pipeline:

- User types a message
- GLiNER (local neural NER) detects PII on-device
- Only anonymized categorical attributes are sent to the cloud (`income_bracket: 50k–75k`, not `Salary: €62,500`)
- Cloud LLM responds with placeholders (`[INCOME]`)
- Local rehydration fills real values back in
- PII never leaves the machine

**The emotional hook:** You tell AI things you wouldn't tell your doctor. With cloud AI, those things become training data and ad targeting. Sovereign AI prevents this.

---

## The Narrative We Want

**New narrative arc (not yet fully built, just in the style test):**

1. **Cloud AI user** asks health questions (diabetes, insulin costs, insurance)
2. **Data streams silently to the cloud**
3. **AD REVEAL**: Targeted ads appear — "Metformin 40% off", "Health plan for diabetics" — matching exactly what they asked
4. **Tagline**: *"Because you asked. Now they know."*
5. **Cut to Sovereign AI**: Same scenario, but the privacy pipeline protects them
6. **CTA**: Download free

---

## The 3 Style Test Scenes

### Scene A (0–3s): Visual Language
- Pure black background (`#000000`)
- Purple radial gradient "pool of light"
- Shield logo with bloom glow (drop-shadow filter)
- Glass card (rgba white background, 1px border, inset glow)
- Shimmer sweep animation across card
- Inter font, gradient text, film grain overlay

### Scene B (3–7s): The Ad Reveal
- Left: Cloud AI chat window with 3 health queries typing in
- Center: Red data stream particles flowing right
- Right: Targeted ads sliding in with yellow "AD" label
- Red danger-tinted radial background
- Tagline: *"Because you asked. Now they know."*

### Scene C (7–10s): Sovereign AI Hero
- Pulsing shield with bloom glow
- Orbiting particle ring (elliptical, subtle)
- Gradient text: white → violet
- CTA buttons: filled purple + ghost outline

---

## Design Decisions Made

| Decision | Rationale |
|---|---|
| `#000000` background | Vantablack canvas — maximum contrast |
| Radial gradient pools | Creates "depth" and focal points without being busy |
| Glass cards: `rgba(255,255,255,0.03)` + `1px rgba(255,255,255,0.08)` border | Glassmorphism that reads as floating, not flat |
| Film grain: SVG feTurbulence at 2.8% opacity | Adds texture, prevents "too perfect CGI" feel |
| Spring config: `{ mass: 0.5, damping: 12, stiffness: 100 }` | "Heavy yet smooth" — avoids bouncy toy feel |
| Font: Inter, weight 800 for headings, 300 for body | Available, pairs well with the dark aesthetic |
| Purple (`#7c3aed`) as primary accent | Brand color from existing app |
| Red data stream for "threat" scene | Danger signal, minimal and abstract |
| Yellow (`#fbbf24`) for ad labels | Universally recognized "ad" color |

---

## The Full StylePreview.tsx Code

```tsx
/**
 * StylePreview — 10-second visual test (300 frames @ 30fps)
 *
 * Three mini-scenes to validate the aesthetic before full rebuild:
 *   0–3s  : Visual language (background, glass card, typography, film grain, glow)
 *   3–7s  : The "ad reveal" contrast moment
 *   7–10s : Sovereign AI shield + radial glow
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

const C = {
  bg:          "#000000",
  purple:      "#7c3aed",
  purpleLight: "#a78bfa",
  purpleDim:   "rgba(124, 58, 237, 0.25)",
  white:       "#ffffff",
  whiteDim:    "rgba(255,255,255,0.6)",
  whiteFaint:  "rgba(255,255,255,0.08)",
  glass:       "rgba(255,255,255,0.03)",
  glassBorder: "rgba(255,255,255,0.08)",
  green:       "#22c55e",
  red:         "#ef4444",
  adYellow:    "#fbbf24",
};

const ease = (frame: number, fps: number) =>
  spring({ frame, fps, config: { mass: 0.5, damping: 12, stiffness: 100 } });

const FilmGrain: React.FC = () => (
  <svg width="1920" height="1080"
    style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", opacity: 0.028 }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="1920" height="1080" filter="url(#grain)" />
  </svg>
);

const RadialBg: React.FC<{ cx?: number; cy?: number; color?: string; radius?: number }> = ({
  cx = 960, cy = 540, color = "rgba(109, 40, 217, 0.28)", radius = 600,
}) => (
  <div style={{
    position: "absolute", inset: 0,
    background: `radial-gradient(ellipse ${radius}px ${radius * 0.6}px at ${cx}px ${cy}px, ${color} 0%, transparent 70%)`,
  }} />
);

const GlassCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: C.glass,
    border: `1px solid ${C.glassBorder}`,
    borderRadius: 16,
    boxShadow: [
      "0 0 0 1px rgba(255,255,255,0.04) inset",
      "0 24px 80px rgba(0,0,0,0.6)",
      "0 0 60px rgba(124,58,237,0.08)",
    ].join(", "),
    backdropFilter: "blur(12px)",
    ...style,
  }}>
    {children}
  </div>
);

// Scene A, B, C implementations...
// [see attached file for full code]
```

---

## What We Need Feedback On

Please review the code and design decisions and answer:

1. **Scene B (Ad Reveal)** — Is the left-chat → data-stream → right-ads layout clear and emotionally impactful? What would make the "ad reveal" moment hit harder?

2. **Glass card aesthetic** — The glassmorphism uses very low opacity (`rgba(255,255,255,0.03)`). Will this read as "premium floating glass" or just "barely visible"? Should we push it to 0.05–0.08?

3. **The red data stream** — Currently just small red dots traveling right. Too subtle? Should it be more dramatic (thicker line, more particles, a label like "YOUR DATA")?

4. **Typography** — We're using Inter. Should we load Geist (Vercel's font) via a CDN in Remotion? Is it worth the complexity for the visual upgrade?

5. **The "ad reveal" narrative** — Is using diabetes/health queries the right emotional hook, or is it too heavy? Alternative: financial queries (salary, mortgage)?

6. **Scene transitions** — Currently hard cuts between scenes. Should we add cross-fade or a motion blur transition?

7. **Missing elements** — What key visual elements are missing to reach "Vercel Ship keynote" quality?

8. **Full video structure** — Given this style, what should the full 60-second narrative arc look like? We want to show: the threat, the privacy pipeline working, the 14 advisors council, and a CTA.

---

## Technical Constraints

- **Remotion 4.x** — React 18, TypeScript strict mode
- **No external video** — pure programmatic animation, no screen recordings
- **Render target** — 1920×1080, 30fps, H.264 MP4 for website embed
- **Audio** — voiceover + ambient music to be added separately after render
- **Font loading** — currently using system Inter; can load from Google Fonts via `@remotion/google-fonts`

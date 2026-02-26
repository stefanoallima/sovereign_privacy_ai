# Sovereign AI Promo Video — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 60-second programmatic promotional video for the Sovereign AI website using Remotion 4.x — pure React-animated, no screen recordings required.

**Architecture:** A single Remotion `Composition` (1800 frames, 30fps, 1920×1080) composed of 8 sequential `<Sequence>` scenes. Each scene is an isolated React component driven by `useCurrentFrame()`. Reusable primitives (TypewriterText, ParticleField, PipelineNode, etc.) are shared across scenes.

**Tech Stack:** Remotion 4.x, React 18, TypeScript 5, `@remotion/google-fonts` (Inter), `@remotion/cli`

**Design reference:** `docs/plans/2026-02-26-promo-video-design.md`

---

## Setup

### Task 1: Initialize the Remotion project

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/remotion.config.ts`
- Create: `video/src/Root.tsx`

**Step 1: Create the video directory and package.json**

```bash
mkdir -p video/src/compositions video/src/scenes video/src/components video/src/hooks video/src/constants video/public
```

Create `video/package.json`:
```json
{
  "name": "sovereign-ai-promo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "remotion studio",
    "render": "remotion render src/Root.tsx PromoVideo out/promo.mp4 --codec=h264"
  },
  "dependencies": {
    "@remotion/cli": "4.0.257",
    "@remotion/google-fonts": "4.0.257",
    "remotion": "4.0.257",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  },
  "remotion": {
    "entryPoint": "src/Root.tsx"
  }
}
```

**Step 2: Create tsconfig.json**

Create `video/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "ES2020"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

**Step 3: Create remotion.config.ts**

Create `video/remotion.config.ts`:
```ts
import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

**Step 4: Create the Root entry point**

Create `video/src/Root.tsx`:
```tsx
import { Composition } from "remotion";
import { PromoVideo } from "./compositions/PromoVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
```

**Step 5: Install dependencies**

```bash
cd video && npm install
```

**Step 6: Verify Remotion Studio opens**

```bash
cd video && npm start
```

Expected: Browser opens at `http://localhost:3000`, shows "PromoVideo" composition listed.

**Step 7: Commit**

```bash
cd video && git add . && cd .. && git add video/
git commit -m "feat: initialize Remotion video project scaffold"
```

---

### Task 2: Constants and shared data

**Files:**
- Create: `video/src/constants/colors.ts`
- Create: `video/src/constants/timing.ts`
- Create: `video/src/constants/advisors.ts`

**Step 1: Create color tokens**

Create `video/src/constants/colors.ts`:
```ts
export const COLORS = {
  background: "#0a0a0f",
  accent: "#6c63ff",
  danger: "#ef4444",
  safe: "#22c55e",
  cloud: "#6b7280",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  tauri: "#24C8DB",
  rust: "#DEA584",
  react: "#61DAFB",
} as const;
```

**Step 2: Create timing constants**

Create `video/src/constants/timing.ts`:
```ts
// All values are frame numbers at 30fps
export const TIMING = {
  scene1: { start: 0,    end: 150  }, // 0–5s   The Threat
  scene2: { start: 150,  end: 270  }, // 5–9s   The Turn
  scene3: { start: 270,  end: 510  }, // 9–17s  The Council
  scene4: { start: 510,  end: 870  }, // 17–29s The Pipeline
  scene5: { start: 870,  end: 1110 }, // 29–37s Data Split
  scene6: { start: 1110, end: 1350 }, // 37–45s Local Mode
  scene7: { start: 1350, end: 1500 }, // 45–50s Tech Stack
  scene8: { start: 1500, end: 1800 }, // 50–60s CTA
} as const;
```

**Step 3: Create advisors data**

Create `video/src/constants/advisors.ts`:
```ts
export type PrivacyMode = "LOCAL" | "HYBRID" | "CLOUD";

export interface Advisor {
  handle: string;
  icon: string;
  privacy: PrivacyMode;
}

export const ADVISORS: Advisor[] = [
  { handle: "@psychologist",      icon: "🧠", privacy: "CLOUD"  },
  { handle: "@life-coach",        icon: "🎯", privacy: "CLOUD"  },
  { handle: "@career-coach",      icon: "💼", privacy: "CLOUD"  },
  { handle: "@tax-navigator",     icon: "🧾", privacy: "HYBRID" },
  { handle: "@tax-audit",         icon: "📋", privacy: "HYBRID" },
  { handle: "@legal-advisor",     icon: "⚖️",  privacy: "HYBRID" },
  { handle: "@financial-advisor", icon: "💰", privacy: "HYBRID" },
  { handle: "@health-coach",      icon: "🏃", privacy: "LOCAL"  },
  { handle: "@personal-branding", icon: "✨", privacy: "CLOUD"  },
  { handle: "@social-media",      icon: "📱", privacy: "CLOUD"  },
  { handle: "@real-estate",       icon: "🏠", privacy: "HYBRID" },
  { handle: "@cybersecurity",     icon: "🛡️",  privacy: "LOCAL"  },
  { handle: "@immigration",       icon: "🌍", privacy: "HYBRID" },
  { handle: "@investment",        icon: "📈", privacy: "HYBRID" },
];
```

**Step 4: Commit**

```bash
git add video/src/constants/
git commit -m "feat: add Remotion constants (colors, timing, advisors)"
```

---

## Reusable Components

### Task 3: TypewriterText component

**Files:**
- Create: `video/src/components/TypewriterText.tsx`
- Create: `video/src/hooks/useTypewriter.ts`

**Step 1: Create the hook**

Create `video/src/hooks/useTypewriter.ts`:
```ts
import { useCurrentFrame } from "remotion";

export function useTypewriter(
  text: string,
  startFrame: number,
  charsPerFrame = 0.6
): string {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  return text.slice(0, charsToShow);
}
```

**Step 2: Create the component**

Create `video/src/components/TypewriterText.tsx`:
```tsx
import React from "react";
import { useTypewriter } from "../hooks/useTypewriter";

interface Props {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  cursorVisible?: boolean;
}

export const TypewriterText: React.FC<Props> = ({
  text,
  startFrame,
  charsPerFrame = 0.6,
  style,
  cursorVisible = true,
}) => {
  const displayed = useTypewriter(text, startFrame, charsPerFrame);
  const isComplete = displayed.length === text.length;

  return (
    <span style={style}>
      {displayed}
      {cursorVisible && !isComplete && (
        <span style={{ opacity: 1, marginLeft: 2 }}>|</span>
      )}
    </span>
  );
};
```

**Step 3: Preview — add a quick test composition**

Temporarily add to `video/src/Root.tsx` a second composition:
```tsx
import { Composition, AbsoluteFill } from "remotion";
import { TypewriterText } from "./components/TypewriterText";
import { COLORS } from "./constants/colors";

// Add inside RemotionRoot alongside PromoVideo:
<Composition
  id="TypewriterTest"
  component={() => (
    <AbsoluteFill style={{ background: COLORS.background, justifyContent: "center", alignItems: "center" }}>
      <TypewriterText
        text="My salary is €62,500, BSN: 123-456-789"
        startFrame={10}
        style={{ color: COLORS.textPrimary, fontSize: 40, fontFamily: "Inter" }}
      />
    </AbsoluteFill>
  )}
  durationInFrames={120}
  fps={30}
  width={1920}
  height={1080}
/>
```

Run `npm start`, select TypewriterTest, scrub to frame 30. Expected: text partially typed.

**Step 4: Remove the test composition, commit**

```bash
git add video/src/components/TypewriterText.tsx video/src/hooks/useTypewriter.ts
git commit -m "feat: add TypewriterText component and useTypewriter hook"
```

---

### Task 4: ParticleField component

**Files:**
- Create: `video/src/components/ParticleField.tsx`

**Step 1: Create the component**

Create `video/src/components/ParticleField.tsx`:
```tsx
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  angle: number;
  opacity: number;
}

interface Props {
  count?: number;
  color?: string;
}

export const ParticleField: React.FC<Props> = ({
  count = 60,
  color = COLORS.accent,
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (i * 137.5) % 1920,          // golden-ratio spread
      y: (i * 93.7) % 1080,
      size: 1 + (i % 3),
      speed: 0.2 + (i % 5) * 0.08,
      angle: (i * 47) % 360,
      opacity: 0.15 + (i % 4) * 0.06,
    }));
  }, [count]);

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.speed * frame;
        const dy = Math.sin(rad) * p.speed * frame;
        const cx = ((p.x + dx) % 1920 + 1920) % 1920;
        const cy = ((p.y + dy) % 1080 + 1080) % 1080;
        return (
          <circle
            key={p.id}
            cx={cx}
            cy={cy}
            r={p.size}
            fill={color}
            opacity={p.opacity}
          />
        );
      })}
    </svg>
  );
};
```

**Step 2: Preview in Remotion Studio**

Add a quick test composition (same pattern as Task 3), verify particles drift slowly. Remove test composition after verification.

**Step 3: Commit**

```bash
git add video/src/components/ParticleField.tsx
git commit -m "feat: add ParticleField background component"
```

---

### Task 5: PrivacyBadge and AdvisorCard components

**Files:**
- Create: `video/src/components/PrivacyBadge.tsx`
- Create: `video/src/components/AdvisorCard.tsx`

**Step 1: Create PrivacyBadge**

Create `video/src/components/PrivacyBadge.tsx`:
```tsx
import React from "react";
import { COLORS } from "../constants/colors";
import type { PrivacyMode } from "../constants/advisors";

const BADGE_COLORS: Record<PrivacyMode, string> = {
  LOCAL:  COLORS.safe,
  HYBRID: COLORS.accent,
  CLOUD:  COLORS.cloud,
};

interface Props {
  mode: PrivacyMode;
}

export const PrivacyBadge: React.FC<Props> = ({ mode }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: BADGE_COLORS[mode],
      border: `1px solid ${BADGE_COLORS[mode]}`,
      borderRadius: 4,
      padding: "2px 6px",
      fontFamily: "monospace",
    }}
  >
    {mode}
  </span>
);
```

**Step 2: Create AdvisorCard**

Create `video/src/components/AdvisorCard.tsx`:
```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Advisor } from "../constants/advisors";
import { PrivacyBadge } from "./PrivacyBadge";
import { COLORS } from "../constants/colors";

interface Props {
  advisor: Advisor;
  index: number;
  sceneStartFrame: number;
}

export const AdvisorCard: React.FC<Props> = ({ advisor, index, sceneStartFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 8;
  const localFrame = Math.max(0, frame - sceneStartFrame - delay);

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 20], [20, 0], {
    extrapolateRight: "clamp",
  });
  const scale = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 120, damping: 14 },
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${Math.min(scale, 1)})`,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: 200,
      }}
    >
      <div style={{ fontSize: 28 }}>{advisor.icon}</div>
      <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>
        {advisor.handle}
      </div>
      <PrivacyBadge mode={advisor.privacy} />
    </div>
  );
};
```

**Step 3: Commit**

```bash
git add video/src/components/PrivacyBadge.tsx video/src/components/AdvisorCard.tsx
git commit -m "feat: add PrivacyBadge and AdvisorCard components"
```

---

### Task 6: ModeSelector and TechBadge components

**Files:**
- Create: `video/src/components/ModeSelector.tsx`
- Create: `video/src/components/TechBadge.tsx`
- Create: `video/src/components/ShieldLogo.tsx`

**Step 1: Create ModeSelector**

Create `video/src/components/ModeSelector.tsx`:
```tsx
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

type Mode = "LOCAL" | "HYBRID" | "CLOUD";

interface Props {
  selected: Mode;
  activateFrame: number; // frame when selection animates in
}

const MODES: Mode[] = ["LOCAL", "HYBRID", "CLOUD"];

export const ModeSelector: React.FC<Props> = ({ selected, activateFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - activateFrame);
  const appear = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        opacity: appear,
        transform: `scale(${0.9 + 0.1 * appear})`,
      }}
    >
      {MODES.map((mode) => {
        const isSelected = mode === selected;
        return (
          <div
            key={mode}
            style={{
              padding: "10px 28px",
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: isSelected ? "#fff" : COLORS.textMuted,
              background: isSelected ? COLORS.accent : "rgba(255,255,255,0.05)",
              border: `1px solid ${isSelected ? COLORS.accent : "rgba(255,255,255,0.12)"}`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {mode}
          </div>
        );
      })}
    </div>
  );
};
```

**Step 2: Create TechBadge**

Create `video/src/components/TechBadge.tsx`:
```tsx
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  label: string;
  color: string;
  index: number;
  startFrame: number;
}

export const TechBadge: React.FC<Props> = ({ label, color, index, startFrame }) => {
  const frame = useCurrentFrame();
  const delay = index * 12;
  const localFrame = Math.max(0, frame - startFrame - delay);

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 15], [12, 0], {
    extrapolateRight: "clamp",
  });

  // Pulse glow: peaks at frame 25 of local timeline
  const glowIntensity = interpolate(localFrame, [20, 30, 40], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "10px 24px",
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 700,
        color,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 ${glowIntensity * 20}px ${color}`,
        fontFamily: "monospace",
        letterSpacing: "0.04em",
        background: `${color}10`,
      }}
    >
      {label}
    </div>
  );
};
```

**Step 3: Create ShieldLogo**

Create `video/src/components/ShieldLogo.tsx`:
```tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/colors";

interface Props {
  size?: number;
  startFrame?: number;
}

export const ShieldLogo: React.FC<Props> = ({ size = 80, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - startFrame);

  const scale = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 60, damping: 12 },
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Shield outline */}
      <path
        d="M50 5 L85 20 L85 55 C85 75 67 90 50 97 C33 90 15 75 15 55 L15 20 Z"
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="3"
      />
      {/* Inner fill subtle */}
      <path
        d="M50 5 L85 20 L85 55 C85 75 67 90 50 97 C33 90 15 75 15 55 L15 20 Z"
        fill={`${COLORS.accent}18`}
      />
      {/* Lock icon center */}
      <rect x="38" y="47" width="24" height="20" rx="3" fill={COLORS.accent} />
      <path
        d="M42 47 L42 42 C42 36 58 36 58 42 L58 47"
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="57" r="3" fill={COLORS.background} />
    </svg>
  );
};
```

**Step 4: Commit**

```bash
git add video/src/components/ModeSelector.tsx video/src/components/TechBadge.tsx video/src/components/ShieldLogo.tsx
git commit -m "feat: add ModeSelector, TechBadge, ShieldLogo components"
```

---

## Scenes

### Task 7: Scene 1 — The Threat

**Files:**
- Create: `video/src/scenes/Scene1Threat.tsx`

**Step 1: Create the scene**

Create `video/src/scenes/Scene1Threat.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TypewriterText } from "../components/TypewriterText";
import { COLORS } from "../constants/colors";

// Sensitive tokens in the typed text and their char positions
const FULL_TEXT =
  "My salary is €62,500, BSN: 123-456-789, I have a mortgage on Keizersgracht 42...";

// Highlight ranges [start, end] char indices
const SENSITIVE_RANGES = [
  [13, 21],  // €62,500
  [27, 38],  // 123-456-789
  [57, 73],  // Keizersgracht 42
] as const;

export const Scene1Threat: React.FC = () => {
  const frame = useCurrentFrame();

  // Banner sweeps in from right at frame 100
  const bannerX = interpolate(frame, [100, 130], [1920, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sub-label fades in at frame 115
  const subOpacity = interpolate(frame, [115, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red glow on sensitive tokens pulses
  const glowBlur = 6 + Math.sin(frame * 0.25) * 4;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Fake browser chrome */}
      <div
        style={{
          background: "#1a1a2e",
          border: "1px solid #2d2d4e",
          borderRadius: 16,
          width: 900,
          padding: "20px 32px 32px",
          position: "relative",
        }}
      >
        {/* Browser dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => (
            <div
              key={i}
              style={{ width: 12, height: 12, borderRadius: "50%", background: c }}
            />
          ))}
          <div
            style={{
              marginLeft: 16,
              background: "#2d2d4e",
              borderRadius: 8,
              flex: 1,
              height: 12,
            }}
          />
        </div>

        {/* Chat label */}
        <div
          style={{
            color: COLORS.textMuted,
            fontSize: 13,
            marginBottom: 16,
            letterSpacing: "0.04em",
          }}
        >
          Cloud AI — New conversation
        </div>

        {/* Typed text with sensitive highlights */}
        <div style={{ fontSize: 24, lineHeight: 1.6, color: COLORS.textPrimary, minHeight: 80 }}>
          <SensitiveHighlightText
            text={FULL_TEXT}
            sensitiveRanges={SENSITIVE_RANGES}
            glowBlur={glowBlur}
            startFrame={10}
          />
        </div>
      </div>

      {/* TRANSMITTED banner */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: `translateX(${bannerX}px) translateY(-50%)`,
          background: "rgba(239, 68, 68, 0.9)",
          padding: "20px 60px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#fff",
          }}
        >
          TRANSMITTED TO SERVER
        </div>
        <div
          style={{
            opacity: subOpacity,
            fontSize: 15,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "0.08em",
          }}
        >
          permanent record · training data · ad targeting
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Helper: renders text with glowing highlights on sensitive ranges
function SensitiveHighlightText({
  text,
  sensitiveRanges,
  glowBlur,
  startFrame,
}: {
  text: string;
  sensitiveRanges: readonly (readonly [number, number])[];
  glowBlur: number;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * 0.6));
  const visible = text.slice(0, charsToShow);

  // Split into segments: normal | sensitive
  const segments: { text: string; sensitive: boolean }[] = [];
  let cursor = 0;
  for (const [s, e] of sensitiveRanges) {
    if (cursor < s) segments.push({ text: visible.slice(cursor, Math.min(s, charsToShow)), sensitive: false });
    segments.push({ text: visible.slice(Math.min(s, charsToShow), Math.min(e, charsToShow)), sensitive: true });
    cursor = e;
  }
  if (cursor < charsToShow) segments.push({ text: visible.slice(cursor), sensitive: false });

  return (
    <>
      {segments.map((seg, i) =>
        seg.sensitive ? (
          <span
            key={i}
            style={{
              color: "#fca5a5",
              textShadow: `0 0 ${glowBlur}px #ef4444`,
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      {charsToShow < text.length && <span style={{ opacity: 1 }}>|</span>}
    </>
  );
}
```

**Step 2: Preview**

Temporarily wire Scene1Threat into Root.tsx as a standalone test composition, run `npm start`, scrub through. Verify: text types in, red highlights appear, banner sweeps at frame 100.

**Step 3: Commit**

```bash
git add video/src/scenes/Scene1Threat.tsx
git commit -m "feat: add Scene1 - The Threat"
```

---

### Task 8: Scene 2 — The Turn

**Files:**
- Create: `video/src/scenes/Scene2Turn.tsx`

**Step 1: Create the scene**

Create `video/src/scenes/Scene2Turn.tsx`:
```tsx
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ShieldLogo } from "../components/ShieldLogo";
import { TypewriterText } from "../components/TypewriterText";
import { COLORS } from "../constants/colors";

export const Scene2Turn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flash at frame 0 (the "shatter" of previous scene)
  const flashOpacity = interpolate(frame, [0, 3, 8], [1, 0.6, 0], {
    extrapolateRight: "clamp",
  });

  // Logo spring entrance at frame 20
  const logoScale = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { stiffness: 55, damping: 11 },
  });

  // Overall opacity of content (avoid flash blinding)
  const contentOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Converging particles
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        angle: (i / 28) * 360,
        speed: 6 + (i % 4) * 1.5,
        size: 2 + (i % 3),
      })),
    []
  );

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#fff",
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Converging particles */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0, opacity: contentOpacity }}
      >
        {particles.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const maxDist = 400;
          const traveled = Math.min(frame * p.speed, maxDist);
          const dist = maxDist - traveled;
          const cx = 960 + Math.cos(rad) * dist;
          const cy = 540 + Math.sin(rad) * dist;
          const particleOpacity = interpolate(traveled, [0, maxDist * 0.7, maxDist], [0.6, 0.8, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <circle key={i} cx={cx} cy={cy} r={p.size} fill={COLORS.accent} opacity={particleOpacity} />
          );
        })}
      </svg>

      {/* Logo + tagline */}
      <div
        style={{
          opacity: contentOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div style={{ transform: `scale(${logoScale})` }}>
          <ShieldLogo size={140} startFrame={0} />
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: COLORS.textPrimary }}>
            Sovereign AI
          </div>
          <div
            style={{
              fontSize: 24,
              color: COLORS.textMuted,
              marginTop: 12,
            }}
          >
            <TypewriterText
              text="Your data is yours. Not theirs."
              startFrame={50}
              charsPerFrame={1}
              style={{ color: COLORS.textMuted }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

**Step 2: Preview, verify flash → particles → logo spring → tagline typewriter**

**Step 3: Commit**

```bash
git add video/src/scenes/Scene2Turn.tsx
git commit -m "feat: add Scene2 - The Turn"
```

---

### Task 9: Scene 3 — The Council

**Files:**
- Create: `video/src/scenes/Scene3Council.tsx`

**Step 1: Create the scene**

Create `video/src/scenes/Scene3Council.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdvisorCard } from "../components/AdvisorCard";
import { ADVISORS } from "../constants/advisors";
import { COLORS } from "../constants/colors";

export const Scene3Council: React.FC = () => {
  const frame = useCurrentFrame();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Highlight sweep over @tax-navigator (index 3) and @health-coach (index 7)
  // Starts after all cards have animated in: ~14*8 = 112 + 20 buffer = frame 132
  const sweepFrame = Math.max(0, frame - 132);
  const highlighted = sweepFrame > 0 ? [3, 7] : [];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "60px 80px",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.textMuted,
          letterSpacing: "0.04em",
        }}
      >
        Your Private Council
      </div>

      {/* Grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        {ADVISORS.map((advisor, i) => (
          <div
            key={advisor.handle}
            style={{
              outline: highlighted.includes(i)
                ? `2px solid ${COLORS.accent}`
                : "2px solid transparent",
              borderRadius: 14,
              boxShadow: highlighted.includes(i)
                ? `0 0 20px ${COLORS.accent}44`
                : "none",
              transition: "none",
            }}
          >
            <AdvisorCard
              advisor={advisor}
              index={i}
              sceneStartFrame={0}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

**Step 2: Preview. Verify cards stagger in, two get highlighted.**

**Step 3: Commit**

```bash
git add video/src/scenes/Scene3Council.tsx
git commit -m "feat: add Scene3 - The Council"
```

---

### Task 10: Scene 4 — The Pipeline Centerpiece

This is the most complex scene. Build it in two steps: static layout first, then animate.

**Files:**
- Create: `video/src/components/PipelineNode.tsx`
- Create: `video/src/scenes/Scene4Pipeline.tsx`

**Step 1: Create PipelineNode**

Create `video/src/components/PipelineNode.tsx`:
```tsx
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface Props {
  label: string;
  sublabel?: string;
  activateFrame: number;
  glowColor?: string;
  x: number;
  y: number;
  width?: number;
}

export const PipelineNode: React.FC<Props> = ({
  label,
  sublabel,
  activateFrame,
  glowColor = COLORS.accent,
  x,
  y,
  width = 180,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - activateFrame);

  const opacity = interpolate(local, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const glow = interpolate(local, [0, 10, 30], [0, 1, 0.3], { extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, 8], [0.85, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        background: `${glowColor}14`,
        border: `1.5px solid ${glowColor}`,
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: `0 0 ${glow * 24}px ${glowColor}`,
        fontFamily: "Inter, monospace",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: glowColor }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
};
```

**Step 2: Create Scene4Pipeline**

Create `video/src/scenes/Scene4Pipeline.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PipelineNode } from "../components/PipelineNode";
import { COLORS } from "../constants/colors";

// Node positions (centered in 1920x1080)
// Row 1 y=320, Row 2 y=560
const NODES = [
  { id: "msg",    label: "Your Message",     sublabel: undefined,      x: 160,  y: 320, color: COLORS.textMuted,  activateFrame: 10  },
  { id: "gliner", label: "GLiNER Shield",    sublabel: "PII detection",x: 440,  y: 320, color: COLORS.safe,       activateFrame: 30  },
  { id: "router", label: "Backend Router",   sublabel: undefined,      x: 720,  y: 320, color: COLORS.accent,     activateFrame: 50  },
  { id: "attr",   label: "Attribute Extract",sublabel: "categories only", x: 960, y: 560, color: COLORS.accent,   activateFrame: 70  },
  { id: "cloud",  label: "Cloud LLM",        sublabel: "EU-based",     x: 680,  y: 560, color: COLORS.cloud,      activateFrame: 90  },
  { id: "rehy",   label: "Rehydration",      sublabel: "local only",   x: 400,  y: 560, color: COLORS.safe,       activateFrame: 110 },
] as const;

// SVG path connecting nodes (approximate polyline)
const PATH_D =
  "M 250 352 L 530 352 L 810 352 L 1050 592 L 770 592 L 490 592";

export const Scene4Pipeline: React.FC = () => {
  const frame = useCurrentFrame();

  // Particle travels along the path: starts at frame 130
  const particleProgress = interpolate(frame, [130, 280], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dotted line draws progressively
  const lineProgress = interpolate(frame, [10, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Approx path length for strokeDasharray (measured manually for this path)
  const pathLength = 1100;
  const dashOffset = pathLength * (1 - lineProgress);

  // Simplified particle position along the path segments
  // 5 segments: each ~220px
  const pathPoints = [
    { x: 250, y: 352 },
    { x: 530, y: 352 },
    { x: 810, y: 352 },
    { x: 1050, y: 592 },
    { x: 770, y: 592 },
    { x: 490, y: 592 },
  ];
  const particleXY = getPointAlongPolyline(pathPoints, particleProgress);

  // Redaction text: chars become █ when particle passes GLiNER node (~progress 0.2)
  const redactionProgress = interpolate(frame, [155, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Response bubble appears when particle reaches Cloud node (~progress 0.7)
  const bubbleOpacity = interpolate(frame, [220, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rehydration morph: [INCOME] → €62,500 at frame 265
  const rehydrateProgress = interpolate(frame, [265, 285], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, monospace",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.textMuted,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Privacy Pipeline
      </div>

      {/* SVG: connecting lines + particle */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Dotted path */}
        <path
          d={PATH_D}
          fill="none"
          stroke={COLORS.accent}
          strokeWidth={2}
          strokeDasharray={`${pathLength}`}
          strokeDashoffset={dashOffset}
          opacity={0.4}
        />

        {/* Traveling particle */}
        {particleProgress > 0 && particleProgress < 1 && (
          <circle
            cx={particleXY.x}
            cy={particleXY.y}
            r={7}
            fill={COLORS.accent}
            style={{ filter: `drop-shadow(0 0 8px ${COLORS.accent})` }}
          />
        )}

        {/* Blocked red path at Attribute Extract: "BSN: 123..." */}
        {frame > 200 && (
          <>
            <line x1={1050} y1={560} x2={1050} y2={490} stroke={COLORS.danger} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />
            <text x={1065} y={525} fill={COLORS.danger} fontSize={12} fontFamily="monospace">BSN: 123... ✕</text>
          </>
        )}
      </svg>

      {/* Pipeline nodes */}
      {NODES.map((n) => (
        <PipelineNode
          key={n.id}
          label={n.label}
          sublabel={n.sublabel}
          activateFrame={n.activateFrame}
          glowColor={n.color}
          x={n.x}
          y={n.y}
        />
      ))}

      {/* Redacted text near GLiNER node */}
      {frame > 140 && (
        <div
          style={{
            position: "absolute",
            left: 370,
            top: 270,
            fontSize: 12,
            fontFamily: "monospace",
            color: COLORS.safe,
            opacity: interpolate(frame, [140, 155], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {redactionProgress > 0.5
            ? "█████, BSN: █████████"
            : "€62,500, BSN: 123-456-789"}
        </div>
      )}

      {/* Cloud LLM response bubble */}
      {bubbleOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 580,
            top: 500,
            background: "rgba(107, 114, 128, 0.15)",
            border: `1px solid ${COLORS.cloud}`,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            color: COLORS.cloud,
            opacity: bubbleOpacity,
          }}
        >
          Your [INCOME] falls in the 40% bracket...
        </div>
      )}

      {/* Rehydrated response */}
      {rehydrateProgress > 0 && (
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 640,
            fontSize: 13,
            color: COLORS.safe,
            opacity: rehydrateProgress,
          }}
        >
          Your <strong>€62,500</strong> falls in the 40% bracket...
          <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.textMuted }}>← real values restored locally</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Utility: interpolate a point along a polyline by [0,1] progress
function getPointAlongPolyline(
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };

  const segments: { length: number; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segments.push({ length: len, p1: points[i], p2: points[i + 1] });
    total += len;
  }

  let target = t * total;
  for (const seg of segments) {
    if (target <= seg.length) {
      const ratio = target / seg.length;
      return {
        x: seg.p1.x + ratio * (seg.p2.x - seg.p1.x),
        y: seg.p1.y + ratio * (seg.p2.y - seg.p1.y),
      };
    }
    target -= seg.length;
  }
  return points[points.length - 1];
}
```

**Step 3: Preview, verify node stagger, dotted line draw, particle travel, redaction, cloud bubble, rehydration**

**Step 4: Commit**

```bash
git add video/src/components/PipelineNode.tsx video/src/scenes/Scene4Pipeline.tsx
git commit -m "feat: add Scene4 - The Pipeline centerpiece"
```

---

### Task 11: Scene 5 — Data Split

**Files:**
- Create: `video/src/scenes/Scene5DataSplit.tsx`

**Step 1: Create the scene**

Create `video/src/scenes/Scene5DataSplit.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

const LEFT_DATA = [
  "Jan de Vries",
  "BSN: 123-456-789",
  "Salary: €62,500",
  "Keizersgracht 42, Amsterdam",
];

const RIGHT_DATA = [
  "[PERSON]",
  "[IDENTIFIER]",
  "income_bracket: 50k–75k",
  "[ADDRESS]",
];

export const Scene5DataSplit: React.FC = () => {
  const frame = useCurrentFrame();

  // Divider draws down
  const dividerHeight = interpolate(frame, [10, 40], [0, 1080], {
    extrapolateRight: "clamp",
  });

  // Divider pulse
  const dividerGlow = 4 + Math.sin(frame * 0.15) * 3;

  // Panel labels fade in
  const labelOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, monospace",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          padding: "80px 80px 80px 120px",
          borderRight: "none",
          background: `${COLORS.safe}08`,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            opacity: labelOpacity,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 24 }}>🔒</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.safe }}>
            What stays on your machine
          </span>
        </div>
        {LEFT_DATA.map((line, i) => {
          const lineOpacity = interpolate(frame, [40 + i * 15, 55 + i * 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineX = interpolate(frame, [40 + i * 15, 55 + i * 15], [-20, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                fontSize: 22,
                color: COLORS.textPrimary,
                fontWeight: 500,
                fontFamily: "monospace",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <svg
        width={4}
        height={1080}
        style={{ flexShrink: 0 }}
      >
        <line
          x1={2}
          y1={0}
          x2={2}
          y2={dividerHeight}
          stroke={COLORS.accent}
          strokeWidth={3}
          style={{ filter: `drop-shadow(0 0 ${dividerGlow}px ${COLORS.accent})` }}
        />
      </svg>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          padding: "80px 120px 80px 80px",
          background: `${COLORS.cloud}08`,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            opacity: labelOpacity,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 24 }}>☁️</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.cloud }}>
            What the cloud sees
          </span>
        </div>
        {RIGHT_DATA.map((line, i) => {
          const lineOpacity = interpolate(frame, [40 + i * 15, 55 + i * 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineX = interpolate(frame, [40 + i * 15, 55 + i * 15], [20, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                fontSize: 22,
                color: COLORS.textMuted,
                fontWeight: 500,
                fontFamily: "monospace",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.textPrimary,
          opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Powerful models get the context.{" "}
        <span style={{ color: COLORS.accent }}>You keep the identity.</span>
      </div>
    </AbsoluteFill>
  );
};
```

**Step 2: Preview, commit**

```bash
git add video/src/scenes/Scene5DataSplit.tsx
git commit -m "feat: add Scene5 - Data Split"
```

---

### Task 12: Scene 6, 7, 8 — Local Mode, Tech Stack, CTA

**Files:**
- Create: `video/src/scenes/Scene6LocalMode.tsx`
- Create: `video/src/scenes/Scene7TechStack.tsx`
- Create: `video/src/scenes/Scene8CTA.tsx`

**Step 1: Create Scene6LocalMode**

Create `video/src/scenes/Scene6LocalMode.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ModeSelector } from "../components/ModeSelector";
import { COLORS } from "../constants/colors";

export const Scene6LocalMode: React.FC = () => {
  const frame = useCurrentFrame();

  // Wi-Fi icon + strike animates in at frame 60
  const wifiOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  // Token stream starts at frame 90
  const tokenCount = Math.floor(interpolate(frame, [90, 230], [0, 40], { extrapolateRight: "clamp" }));
  const TOKENS = "The privacy pipeline protects your identity by running GLiNER locally. Zero network requests. Fully sovereign. All inference happens on your hardware.".split(" ");

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 60,
      }}
    >
      {/* Mode selector */}
      <ModeSelector selected="LOCAL" activateFrame={10} />

      {/* Wi-Fi off badge */}
      <div
        style={{
          opacity: wifiOpacity,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "rgba(239, 68, 68, 0.1)",
          border: `1px solid ${COLORS.danger}`,
          borderRadius: 12,
          padding: "12px 28px",
        }}
      >
        <span style={{ fontSize: 28 }}>📵</span>
        <div>
          <div style={{ color: COLORS.danger, fontWeight: 700 }}>Network: Disconnected</div>
          <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: "monospace" }}>
            ↑ 0 kbps &nbsp;&nbsp; ↓ 0 kbps
          </div>
        </div>
      </div>

      {/* Token stream output */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "20px 32px",
          width: 800,
          minHeight: 80,
          fontSize: 16,
          color: COLORS.textPrimary,
          lineHeight: 1.7,
          fontFamily: "monospace",
          opacity: interpolate(frame, [88, 95], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {TOKENS.slice(0, tokenCount).join(" ")}
        {tokenCount < TOKENS.length && (
          <span style={{ opacity: 0.6 }}>▌</span>
        )}
      </div>
    </AbsoluteFill>
  );
};
```

**Step 2: Create Scene7TechStack**

Create `video/src/scenes/Scene7TechStack.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TechBadge } from "../components/TechBadge";
import { COLORS } from "../constants/colors";

const BADGES = [
  { label: "Tauri 2",   color: COLORS.tauri  },
  { label: "Rust",      color: COLORS.rust   },
  { label: "React 19",  color: COLORS.react  },
  { label: "GLiNER",    color: COLORS.accent },
];

export const Scene7TechStack: React.FC = () => {
  const frame = useCurrentFrame();

  const subOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 48,
      }}
    >
      <div style={{ display: "flex", gap: 24 }}>
        {BADGES.map((b, i) => (
          <TechBadge key={b.label} label={b.label} color={b.color} index={i} startFrame={10} />
        ))}
      </div>

      <div
        style={{
          opacity: subOpacity,
          fontSize: 18,
          color: COLORS.textMuted,
          letterSpacing: "0.06em",
        }}
      >
        Open source &nbsp;·&nbsp; MIT License &nbsp;·&nbsp; Windows &amp; macOS
      </div>
    </AbsoluteFill>
  );
};
```

**Step 3: Create Scene8CTA**

Create `video/src/scenes/Scene8CTA.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ShieldLogo } from "../components/ShieldLogo";
import { ParticleField } from "../components/ParticleField";
import { COLORS } from "../constants/colors";

export const Scene8CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: Math.max(0, frame - 10), fps, config: { stiffness: 50, damping: 14 } });

  const btn1Opacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const btn2Opacity = interpolate(frame, [65, 85], [0, 1], { extrapolateRight: "clamp" });
  const tagOpacity  = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });

  // Slow zoom out
  const bgScale = interpolate(frame, [0, 300], [1.04, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        transform: `scale(${bgScale})`,
      }}
    >
      <ParticleField count={50} color={COLORS.accent} />

      <div style={{ transform: `scale(${logoScale})`, zIndex: 1 }}>
        <ShieldLogo size={160} startFrame={0} />
      </div>

      <div
        style={{
          zIndex: 1,
          textAlign: "center",
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800, color: COLORS.textPrimary }}>
          Sovereign AI
        </div>
        <div style={{ fontSize: 20, color: COLORS.textMuted, marginTop: 8 }}>
          Privacy-first AI. Free &amp; open source.
        </div>
      </div>

      {/* CTA Buttons */}
      <div style={{ display: "flex", gap: 20, zIndex: 1 }}>
        <div
          style={{
            opacity: btn1Opacity,
            background: COLORS.accent,
            color: "#fff",
            padding: "16px 48px",
            borderRadius: 100,
            fontSize: 18,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Download Free
        </div>
        <div
          style={{
            opacity: btn2Opacity,
            border: `2px solid ${COLORS.accent}`,
            color: COLORS.accent,
            padding: "16px 48px",
            borderRadius: 100,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          View on GitHub
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: tagOpacity,
          fontSize: 16,
          color: COLORS.textMuted,
          letterSpacing: "0.08em",
          zIndex: 1,
        }}
      >
        Your data. Your rules.
      </div>
    </AbsoluteFill>
  );
};
```

**Step 4: Preview all three scenes individually**

**Step 5: Commit**

```bash
git add video/src/scenes/Scene6LocalMode.tsx video/src/scenes/Scene7TechStack.tsx video/src/scenes/Scene8CTA.tsx
git commit -m "feat: add Scene6 LocalMode, Scene7 TechStack, Scene8 CTA"
```

---

## Assembly

### Task 13: Assemble PromoVideo composition

**Files:**
- Create: `video/src/compositions/PromoVideo.tsx`

**Step 1: Create the main composition**

Create `video/src/compositions/PromoVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Threat }   from "../scenes/Scene1Threat";
import { Scene2Turn }     from "../scenes/Scene2Turn";
import { Scene3Council }  from "../scenes/Scene3Council";
import { Scene4Pipeline } from "../scenes/Scene4Pipeline";
import { Scene5DataSplit } from "../scenes/Scene5DataSplit";
import { Scene6LocalMode } from "../scenes/Scene6LocalMode";
import { Scene7TechStack } from "../scenes/Scene7TechStack";
import { Scene8CTA }      from "../scenes/Scene8CTA";
import { TIMING }         from "../constants/timing";

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={TIMING.scene1.start} durationInFrames={TIMING.scene1.end - TIMING.scene1.start}>
        <Scene1Threat />
      </Sequence>
      <Sequence from={TIMING.scene2.start} durationInFrames={TIMING.scene2.end - TIMING.scene2.start}>
        <Scene2Turn />
      </Sequence>
      <Sequence from={TIMING.scene3.start} durationInFrames={TIMING.scene3.end - TIMING.scene3.start}>
        <Scene3Council />
      </Sequence>
      <Sequence from={TIMING.scene4.start} durationInFrames={TIMING.scene4.end - TIMING.scene4.start}>
        <Scene4Pipeline />
      </Sequence>
      <Sequence from={TIMING.scene5.start} durationInFrames={TIMING.scene5.end - TIMING.scene5.start}>
        <Scene5DataSplit />
      </Sequence>
      <Sequence from={TIMING.scene6.start} durationInFrames={TIMING.scene6.end - TIMING.scene6.start}>
        <Scene6LocalMode />
      </Sequence>
      <Sequence from={TIMING.scene7.start} durationInFrames={TIMING.scene7.end - TIMING.scene7.start}>
        <Scene7TechStack />
      </Sequence>
      <Sequence from={TIMING.scene8.start} durationInFrames={TIMING.scene8.end - TIMING.scene8.start}>
        <Scene8CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
```

**Step 2: Open Remotion Studio and scrub full timeline**

```bash
cd video && npm start
```

Select `PromoVideo`, play from frame 0 to 1800. Check each scene transition.

**Step 3: Fix any TypeScript errors**

```bash
cd video && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add video/src/compositions/PromoVideo.tsx
git commit -m "feat: assemble full PromoVideo composition"
```

---

## Audio & Render

### Task 14: Audio integration (optional, drop-in)

**Files:**
- `video/public/voiceover.mp3` — drop in your ElevenLabs render
- `video/public/music.mp3` — drop in ambient track
- Modify: `video/src/compositions/PromoVideo.tsx`

**Step 1: If you have audio files, add to PromoVideo.tsx**

Add at the top of `PromoVideo`'s return (inside `<AbsoluteFill>`):

```tsx
import { Audio } from "remotion";

// Inside <AbsoluteFill>:
<Audio src={staticFile("music.mp3")} volume={0.25} />
<Audio src={staticFile("voiceover.mp3")} volume={1.0} />
```

Add `import { staticFile } from "remotion";` at top.

If no audio yet, skip this task — the video renders silently and audio can be added in any video editor.

**Step 2: Commit if audio added**

```bash
git add video/public/ video/src/compositions/PromoVideo.tsx
git commit -m "feat: add audio tracks to PromoVideo"
```

---

### Task 15: Final render

**Step 1: Render to MP4**

```bash
cd video && npm run render
```

Expected: `video/out/promo.mp4` created (~1800 frames, ~60 seconds)

**Step 2: Verify output**

Open `out/promo.mp4` in any video player. Scrub through all 8 scenes.

**Step 3: Copy to website**

```bash
cp video/out/promo.mp4 website/promo.mp4
```

**Step 4: Final commit**

```bash
git add video/out/promo.mp4 website/promo.mp4
git commit -m "feat: add rendered promo video to website"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Remotion project initialized, opens in Studio |
| 2 | Constants: colors, timing, advisors |
| 3 | TypewriterText + useTypewriter |
| 4 | ParticleField |
| 5 | PrivacyBadge + AdvisorCard |
| 6 | ModeSelector + TechBadge + ShieldLogo |
| 7 | Scene1: The Threat |
| 8 | Scene2: The Turn |
| 9 | Scene3: The Council |
| 10 | Scene4: The Pipeline (centerpiece) |
| 11 | Scene5: Data Split |
| 12 | Scene6 + Scene7 + Scene8 |
| 13 | PromoVideo assembled, full timeline plays |
| 14 | Audio drop-in (optional) |
| 15 | Rendered to promo.mp4 |

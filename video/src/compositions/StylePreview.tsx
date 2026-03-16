/**
 * StylePreview v2 — 10-second visual test (300 frames @ 30fps)
 *
 * Changes from v1 based on feedback:
 *  - Glass card opacity 0.03 → 0.07, gradient "light-catching" border
 *  - Data stream: horizontal "data packet" lines with trailing fade
 *  - Ad reveal: glitch/flicker tied to packet arrival + nerve connection lines
 *  - Chromatic aberration during Scene B
 *  - Layered void depth (4 radial gradients)
 *  - Spatial transitions: scenes overlap 15 frames, zoom/fade instead of hard cut
 *  - Button light sweep in Scene C
 *  - Tighter Inter kerning approximating Geist
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
import { AppMockup } from "../components/AppMockup";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:           "#000000",
  purple:       "#7c3aed",
  purpleLight:  "#a78bfa",
  white:        "#ffffff",
  whiteDim:     "rgba(255,255,255,0.55)",
  glass:        "rgba(255,255,255,0.07)",   // v2: was 0.03
  green:        "#22c55e",
  red:          "#ef4444",
  adYellow:     "#fbbf24",
};

const FONT = "Inter, system-ui, sans-serif";

const easeSpring = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { mass: 0.5, damping: 12, stiffness: 100 },
  });

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Film grain — SVG feTurbulence, ~2.8% opacity */
const FilmGrain: React.FC = () => (
  <svg width="1920" height="1080"
    style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.028 }}>
    <filter id="fg">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="1920" height="1080" filter="url(#fg)" />
  </svg>
);

/**
 * VoidDepth — 4 layered radial gradients creating "alive" dark space.
 * Primary pool + 3 dim satellite glows.
 */
const VoidDepth: React.FC<{ mood?: "purple" | "red" }> = ({ mood = "purple" }) => {
  const layers = mood === "red"
    ? [
        "radial-gradient(ellipse 900px 600px at 960px 480px, rgba(127,29,29,0.22) 0%, transparent 70%)",
        "radial-gradient(ellipse 600px 400px at 300px 200px, rgba(88,20,20,0.12) 0%, transparent 60%)",
        "radial-gradient(ellipse 500px 350px at 1600px 800px, rgba(60,20,60,0.10) 0%, transparent 60%)",
        "radial-gradient(ellipse 800px 300px at 960px 1000px, rgba(30,10,10,0.18) 0%, transparent 70%)",
      ]
    : [
        "radial-gradient(ellipse 900px 600px at 960px 420px, rgba(88,28,235,0.22) 0%, transparent 70%)",
        "radial-gradient(ellipse 600px 400px at 1500px 200px, rgba(49,46,129,0.14) 0%, transparent 60%)",
        "radial-gradient(ellipse 500px 350px at 300px 850px, rgba(67,20,138,0.10) 0%, transparent 60%)",
        "radial-gradient(ellipse 800px 300px at 960px 1000px, rgba(30,27,75,0.18) 0%, transparent 70%)",
      ];
  return (
    <div style={{ position: "absolute", inset: 0, background: layers.join(", ") }} />
  );
};

/**
 * GlassCard v2 — gradient border (light-catching top-left edge).
 * Wrapper technique: 1px gradient padding, inner fill.
 */
const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accentBorder?: boolean;
}> = ({ children, style, accentBorder = false }) => (
  <div style={{
    background: accentBorder
      ? "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)"
      : "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
    borderRadius: 17,
    padding: 1,
    ...style,
  }}>
    <div style={{
      background: C.glass,
      borderRadius: 16,
      backdropFilter: "blur(16px)",
      boxShadow: [
        "0 0 0 1px rgba(255,255,255,0.03) inset",
        "0 24px 80px rgba(0,0,0,0.7)",
        `0 0 60px rgba(124,58,237,0.06)`,
      ].join(", "),
      width: "100%",
      height: "100%",
    }}>
      {children}
    </div>
  </div>
);

/** Chromatic aberration overlay — for "threat" moments */
const ChromaticAberration: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    boxShadow: [
      `inset ${4 * intensity}px 0 0 rgba(255,0,0,0.04)`,
      `inset -${4 * intensity}px 0 0 rgba(0,100,255,0.04)`,
      `inset 0 ${2 * intensity}px 0 rgba(255,0,0,0.02)`,
      `inset 0 -${2 * intensity}px 0 rgba(0,100,255,0.02)`,
    ].join(", "),
  }} />
);

// ─── SCENE A — Visual Language (frames 0–105, local 0–105) ───────────────────

const SceneA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale   = easeSpring(frame, fps, 8);
  const cardOpacity = interpolate(frame, [18, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardY       = interpolate(frame, [18, 48], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tagOpacity  = interpolate(frame, [44, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Shimmer sweep: left to right across card
  const shimmerX = interpolate(frame, [28, 85], [-200, 2120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Exit: zoom out + fade for spatial transition
  const exitScale   = interpolate(frame, [80, 105], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitOpacity = interpolate(frame, [82, 105], [1, 0],    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: C.bg, fontFamily: FONT,
      opacity: exitOpacity,
      transform: `scale(${exitScale})`,
    }}>
      <FilmGrain />
      <VoidDepth mood="purple" />

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 44,
      }}>
        {/* Shield with bloom */}
        <div style={{
          transform: `scale(${Math.min(logoScale, 1.02)})`,
          filter: [
            "drop-shadow(0 0 40px rgba(124,58,237,0.75))",
            "drop-shadow(0 0 10px rgba(167,139,250,0.95))",
            "drop-shadow(0 0 2px rgba(255,255,255,0.5))",
          ].join(" "),
        }}>
          <ShieldSVG size={88} />
        </div>

        {/* Glass card */}
        <div style={{ opacity: cardOpacity, transform: `translateY(${cardY}px)`, position: "relative" }}>
          <GlassCard style={{ minWidth: 560 }}>
            {/* Shimmer sweep */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: 140, borderRadius: 16,
              left: shimmerX, overflow: "hidden",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              pointerEvents: "none",
            }} />
            <div style={{ padding: "32px 56px", textAlign: "center" }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.22em",
                color: C.purpleLight, textTransform: "uppercase", marginBottom: 18,
              }}>
                Privacy-first AI
              </div>
              <div style={{
                fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em",
                background: "linear-gradient(160deg, #ffffff 30%, #a78bfa 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                lineHeight: 1.05,
              }}>
                Sovereign AI
              </div>
              <div style={{
                fontSize: 18, color: C.whiteDim, marginTop: 14,
                fontWeight: 300, letterSpacing: "-0.02em",
              }}>
                Your data is yours. Not theirs.
              </div>
            </div>
          </GlassCard>
        </div>

        <div style={{
          opacity: tagOpacity,
          fontSize: 12, color: "rgba(255,255,255,0.22)", letterSpacing: "0.10em",
        }}>
          Open source · MIT · Windows &amp; macOS
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE B — The Ad Reveal (frames 105–225, local 0–120) ──────────────────

const AD_QUERIES = [
  { q: "What are symptoms of type 2 diabetes?",     ad: "💊  Metformin — 40% off. Limited offer."        },
  { q: "How much does insulin cost per month?",      ad: "🏥  Health plan for diabetics. Get a quote."    },
  { q: "Can I get life insurance with diabetes?",    ad: "📋  Pre-existing condition insurance. Apply."   },
];

// Approximate vertical centers for each row (for nerve lines)
const QUERY_Y  = [200, 270, 340];   // left panel row centers (absolute in 1080)
const AD_Y     = [200, 285, 370];   // right panel row centers

const SceneB: React.FC = () => {
  const frame = useCurrentFrame(); // 0–120
  const { fps } = useVideoConfig();

  // Entrance
  const enterOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enterY       = interpolate(frame, [0, 15], [20, 0],{ extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Chat fades in
  const chatOpacity  = interpolate(frame, [8, 30], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Ad panel slides in
  const adPanelX     = interpolate(frame, [38, 62], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const adPanelOp    = interpolate(frame, [38, 62], [0, 1],   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // "Your data at work" label
  const labelOp      = interpolate(frame, [55, 72], [0, 1],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Final tagline
  const tagOp        = interpolate(frame, [95, 112], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Chromatic aberration intensity rises with tension
  const chromaInt = interpolate(frame, [38, 65], [0, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Data packets: horizontal glowing lines moving left→right
  const packets = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    y: 280 + (i % 6) * 80,
    startFrame: i * 5,
    speed: 8 + (i % 4) * 2,
    length: 28 + (i % 3) * 12,
    opacity: 0.5 + (i % 4) * 0.1,
  })), []);

  // Nerve line opacity (faint flickering connection between query and ad)
  const nerveOpacity = (i: number) => {
    const base = interpolate(frame, [55 + i * 12, 70 + i * 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    // Slow flicker
    return base * (0.08 + 0.06 * Math.sin(frame * 0.4 + i * 2.1));
  };

  // Glitch offset for each ad on reveal (brief horizontal jitter)
  const glitchX = (revealFrame: number) => {
    const local = frame - revealFrame;
    if (local < 0 || local > 12) return 0;
    return Math.sin(local * 9.1) * (3 - local * 0.25);
  };

  // LEFT panel x, RIGHT panel x (pixel approx for nerve lines in SVG)
  const L_X = 120 + 560;   // right edge of left panel
  const R_X = 1920 - 120 - 560; // left edge of right panel

  return (
    <AbsoluteFill style={{
      background: C.bg, fontFamily: FONT,
      opacity: enterOpacity,
      transform: `translateY(${enterY}px)`,
    }}>
      <FilmGrain />
      <VoidDepth mood="red" />
      <ChromaticAberration intensity={chromaInt} />

      {/* ── Data packets SVG layer ── */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Nerve lines: query → ad */}
        {AD_QUERIES.map((_, i) => {
          const op = nerveOpacity(i);
          return op > 0.005 ? (
            <line key={`nerve-${i}`}
              x1={L_X} y1={QUERY_Y[i]}
              x2={R_X} y2={AD_Y[i]}
              stroke={C.red}
              strokeWidth={0.8}
              strokeDasharray="4 6"
              opacity={op}
            />
          ) : null;
        })}

        {/* Moving data packets */}
        {packets.map((p, i) => {
          const localF = Math.max(0, frame - p.startFrame);
          const progress = (localF * p.speed / 1920) % 1;
          const x2 = progress * 1920;
          const x1 = Math.max(0, x2 - p.length);
          const trailX1 = Math.max(0, x1 - 60);
          const packetOp = Math.sin(progress * Math.PI) * p.opacity;
          if (packetOp < 0.02) return null;
          return (
            <g key={i}>
              {/* Trail */}
              <line x1={trailX1} y1={p.y} x2={x1} y2={p.y}
                stroke={C.red} strokeWidth={0.6}
                opacity={packetOp * 0.25}
                style={{ filter: "blur(0.5px)" }}
              />
              {/* Packet */}
              <line x1={x1} y1={p.y} x2={x2} y2={p.y}
                stroke={C.red} strokeWidth={1.5}
                opacity={packetOp}
                style={{ filter: `drop-shadow(0 0 3px ${C.red})` }}
              />
            </g>
          );
        })}
      </svg>

      {/* ── Layout ── */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center",
        padding: "0 120px", gap: 60,
      }}>

        {/* LEFT: Cloud AI chat */}
        <div style={{ flex: 1, opacity: chatOpacity }}>
          <GlassCard>
            <div style={{ padding: "22px 24px" }}>
              {/* Chrome dots */}
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                {[C.red, "#f59e0b", C.green].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.65 }} />
                ))}
                <div style={{ marginLeft: 10, flex: 1, height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 6 }} />
              </div>

              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginBottom: 18, letterSpacing: "0.08em" }}>
                CLOUD AI — NEW CONVERSATION
              </div>

              {AD_QUERIES.map((item, i) => {
                const rowOp = interpolate(frame, [i * 9, i * 9 + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{ opacity: rowOp, marginBottom: 14 }}>
                    <div style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "10px 14px",
                      fontSize: 13, color: C.whiteDim, lineHeight: 1.5,
                    }}>
                      {item.q}
                    </div>
                  </div>
                );
              })}

              {/* Typing pulse */}
              <div style={{
                display: "flex", gap: 4, marginTop: 6,
                opacity: interpolate(frame, [28, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    opacity: 0.3 + 0.45 * Math.sin((frame + i * 9) * 0.28),
                  }} />
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT: Ad panel */}
        <div style={{
          flex: 1, opacity: adPanelOp,
          transform: `translateX(${adPanelX}px)`,
        }}>
          <div style={{
            opacity: labelOp,
            fontSize: 10, color: C.adYellow,
            letterSpacing: "0.16em", textTransform: "uppercase",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{
              background: C.adYellow, color: "#000",
              borderRadius: 3, padding: "2px 5px",
              fontSize: 9, fontWeight: 800, letterSpacing: "0.04em",
            }}>AD</span>
            Your data at work
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {AD_QUERIES.map((item, i) => {
              const revealFrame = 45 + i * 14;
              const rowOp = interpolate(frame, [revealFrame, revealFrame + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const rowY  = interpolate(frame, [revealFrame, revealFrame + 12], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const gx    = glitchX(revealFrame);

              return (
                <div key={i} style={{
                  opacity: rowOp,
                  transform: `translateY(${rowY}px) translateX(${gx}px)`,
                }}>
                  <GlassCard accentBorder>
                    <div style={{ padding: "13px 16px" }}>
                      <div style={{ fontSize: 10, color: C.adYellow, marginBottom: 4, fontWeight: 700, letterSpacing: "0.06em" }}>
                        Sponsored
                      </div>
                      <div style={{ fontSize: 14, color: C.white, lineHeight: 1.4 }}>
                        {item.ad}
                      </div>
                    </div>
                  </GlassCard>
                </div>
              );
            })}
          </div>

          <div style={{
            opacity: tagOp,
            fontSize: 13, color: "rgba(255,255,255,0.22)",
            marginTop: 18, fontStyle: "italic", letterSpacing: "-0.01em",
          }}>
            Because you asked. Now they know.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE C — Sovereign Hero (frames 210–300, local 0–90) ──────────────────

const SceneC: React.FC = () => {
  const frame = useCurrentFrame(); // 0–90
  const { fps } = useVideoConfig();

  // Entrance: zoom in + fade
  const enterOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enterScale   = interpolate(frame, [0, 18], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const shieldScale  = easeSpring(frame, fps, 6);
  const textOpacity  = interpolate(frame, [28, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textY        = interpolate(frame, [28, 52], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subOpacity   = interpolate(frame, [46, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Pulsing glow
  const glowSize    = 36 + Math.sin(frame * 0.09) * 10;
  const glowOpacity = 0.62 + Math.sin(frame * 0.09) * 0.14;

  // Button appearance
  const btn1Op = interpolate(frame, [58, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btn2Op = interpolate(frame, [68, 84], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Button light sweep (frame 60–90)
  const sweepX = interpolate(frame, [62, 86], [-60, 340], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Orbiting ring
  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    angle:   (i / 28) * 360,
    radius:  170 + (i % 3) * 22,
    opacity: 0.18 + (i % 4) * 0.07,
    size:    1.2 + (i % 3) * 0.5,
  })), []);

  const ringOp = interpolate(frame, [12, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: C.bg, fontFamily: FONT,
      opacity: enterOpacity,
      transform: `scale(${enterScale})`,
    }}>
      <FilmGrain />
      <VoidDepth mood="purple" />

      {/* Orbiting ring */}
      <svg width={1920} height={1080}
        style={{ position: "absolute", inset: 0, opacity: ringOp }}>
        {particles.map((p, i) => {
          const angle = (p.angle + frame * 0.18) * (Math.PI / 180);
          const cx = 960 + Math.cos(angle) * p.radius;
          const cy = 460 + Math.sin(angle) * p.radius * 0.38;
          return (
            <circle key={i} cx={cx} cy={cy} r={p.size}
              fill={C.purpleLight} opacity={p.opacity} />
          );
        })}
      </svg>

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 36,
      }}>
        {/* Shield */}
        <div style={{
          transform: `scale(${Math.min(shieldScale, 1.04)})`,
          filter: [
            `drop-shadow(0 0 ${glowSize}px rgba(124,58,237,${glowOpacity}))`,
            "drop-shadow(0 0 8px rgba(167,139,250,0.95))",
            "drop-shadow(0 0 2px rgba(255,255,255,0.6))",
          ].join(" "),
        }}>
          <ShieldSVG size={110} />
        </div>

        {/* Headline */}
        <div style={{ opacity: textOpacity, transform: `translateY(${textY}px)`, textAlign: "center" }}>
          <div style={{
            fontSize: 70, fontWeight: 800, letterSpacing: "-0.045em",
            background: "linear-gradient(160deg, #ffffff 25%, #c4b5fd 70%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            lineHeight: 1,
          }}>
            Sovereign AI
          </div>
        </div>

        <div style={{ opacity: subOpacity, textAlign: "center" }}>
          <div style={{
            fontSize: 20, color: C.whiteDim,
            fontWeight: 300, letterSpacing: "-0.02em",
          }}>
            Your data. Your rules. Always.
          </div>
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 14 }}>
          {/* Primary button with light sweep */}
          <div style={{
            opacity: btn1Op,
            position: "relative", overflow: "hidden",
            padding: "15px 44px", borderRadius: 100,
            background: C.purple,
            boxShadow: `0 0 32px rgba(124,58,237,0.45), 0 0 8px rgba(124,58,237,0.3)`,
          }}>
            {/* Light sweep */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: 60,
              left: sweepX,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
              pointerEvents: "none",
            }} />
            <span style={{ color: C.white, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", position: "relative" }}>
              Download Free
            </span>
          </div>

          {/* Ghost button */}
          <div style={{
            opacity: btn2Op,
            padding: "15px 44px", borderRadius: 100,
            border: "1px solid rgba(255,255,255,0.12)",
            color: C.whiteDim, fontSize: 16,
            fontWeight: 300, letterSpacing: "-0.01em",
          }}>
            View on GitHub
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Shared Shield SVG ────────────────────────────────────────────────────────

const ShieldSVG: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.12} viewBox="0 0 100 112">
    <defs>
      <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ffffff" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <path d="M50 4 L88 20 L88 58 C88 80 68 96 50 104 C32 96 12 80 12 58 L12 20 Z"
      fill="rgba(124,58,237,0.14)" stroke="url(#sg)" strokeWidth="2" />
    <rect x="38" y="52" width="24" height="20" rx="3" fill="url(#sg)" />
    <path d="M42 52 L42 46 C42 38 58 38 58 46 L58 52"
      fill="none" stroke="url(#sg)" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="50" cy="62" r="3" fill="#000" />
  </svg>
);

// ─── Scene D — App UI: Cloud threat (actual desktop UI, cloud mode) ───────────

const SceneD: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 80 } });
  const mockupY  = interpolate(enter, [0, 1], [60, 0]);
  const mockupOp = interpolate(enter, [0, 1], [0, 1]);

  const labelOp = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const redTint = interpolate(frame, [30, 90], [0, 0.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // data packets
  const PKTS = [
    { y: 350, delay: 0,  len: 110, spd: 1.1 },
    { y: 390, delay: 6,  len:  80, spd: 1.0 },
    { y: 430, delay: 12, len: 130, spd: 1.15 },
    { y: 410, delay: 18, len:  90, spd: 0.95 },
    { y: 370, delay: 9,  len: 100, spd: 1.05 },
  ] as const;
  const PKT_START = 40;

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <FilmGrain />
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 1200px 700px at 55% 50%, rgba(239,68,68,${redTint}) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Label top */}
      <div style={{
        position: "absolute", top: 48, left: 0, right: 0,
        textAlign: "center", opacity: labelOp,
        fontSize: 13, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "rgba(239,68,68,0.75)",
      }}>
        Without Sovereign AI — your data leaves the device
      </div>

      {/* App mockup */}
      <div style={{
        position: "absolute", left: 60, top: "50%",
        transform: `translate(0, calc(-50% + ${mockupY}px))`,
        opacity: mockupOp,
      }}>
        <AppMockup frame={Math.max(0, frame - 6)} fps={fps} mode="cloud" messageStage={2} scale={0.68} />
      </div>

      {/* Data packets */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {PKTS.map((p, i) => {
          const lf = frame - PKT_START - p.delay;
          if (lf <= 0) return null;
          const prog = Math.min(1, (lf / fps) * p.spd * 0.85);
          const startX = 860;
          const headX = startX + prog * (1920 - startX);
          const tailX = Math.max(startX, headX - p.len);
          const op = interpolate(prog, [0, 0.05, 0.85, 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={i}>
              <line x1={Math.max(startX, tailX - p.len * 0.5)} y1={p.y} x2={tailX} y2={p.y}
                stroke={C.red} strokeWidth={0.7} opacity={op * 0.2} />
              <line x1={tailX} y1={p.y} x2={headX} y2={p.y}
                stroke={C.red} strokeWidth={1.8} opacity={op}
                style={{ filter: "drop-shadow(0 0 4px #ef4444)" }} />
            </g>
          );
        })}
        {frame > 55 && (
          <text x={1830} y={430} fontSize={50} textAnchor="middle"
            opacity={interpolate(frame, [55, 75], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
            ☁️
          </text>
        )}
      </svg>
    </AbsoluteFill>
  );
};

// ─── Scene E — App UI: Side-by-side comparison (cloud vs sovereign) ───────────

const SceneE: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpr = spring({ frame, fps, config: { mass: 0.7, damping: 14, stiffness: 80 } });
  const rightSpr = spring({ frame: Math.max(0, frame - 8), fps, config: { mass: 0.7, damping: 14, stiffness: 80 } });

  const leftX  = interpolate(leftSpr,  [0, 1], [-100, 0]);
  const rightX = interpolate(rightSpr, [0, 1], [100,  0]);
  const leftOp  = interpolate(leftSpr,  [0, 1], [0, 1]);
  const rightOp = interpolate(rightSpr, [0, 1], [0, 1]);
  const labelOp = interpolate(frame, [20, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tagOp   = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const divGlow = 4 + Math.sin(frame * 0.18) * 3;

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, display: "flex", flexDirection: "row" }}>
      <FilmGrain />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%",
        background: "radial-gradient(ellipse 700px 700px at 0% 50%, rgba(239,68,68,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%",
        background: "radial-gradient(ellipse 700px 700px at 100% 50%, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* LEFT — cloud */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, opacity: leftOp, transform: `translateX(${leftX}px)`, paddingLeft: 20 }}>
        <div style={{ opacity: labelOp, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "rgba(239,68,68,0.75)" }}>
          Cloud AI — no protection
        </div>
        <AppMockup frame={Math.max(0, frame - 15)} fps={fps} mode="cloud" messageStage={2} scale={0.52} />
      </div>

      {/* DIVIDER */}
      <svg width={4} height={1080} style={{ flexShrink: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="dg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="25%" stopColor="rgba(124,58,237,0.6)" />
            <stop offset="75%" stopColor="rgba(124,58,237,0.6)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <line x1={2} y1={0} x2={2} y2={1080} stroke="url(#dg2)" strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 ${divGlow}px rgba(124,58,237,0.8))` }} />
      </svg>

      {/* RIGHT — sovereign */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, opacity: rightOp, transform: `translateX(${rightX}px)`, paddingRight: 20 }}>
        <div style={{ opacity: labelOp, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "rgba(167,139,250,0.9)" }}>
          Sovereign AI — fully protected
        </div>
        <AppMockup frame={Math.max(0, frame - 15)} fps={fps} mode="sovereign" messageStage={2} scale={0.52} />
      </div>

      {/* Bottom tagline */}
      <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, textAlign: "center",
        opacity: tagOp, fontSize: 26, fontWeight: 700, color: C.white, letterSpacing: "-0.02em" }}>
        Same question.{" "}
        <span style={{ color: C.purpleLight }}>Completely different privacy.</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Root — overlapping sequences for spatial transitions ─────────────────────

export const StylePreview: React.FC = () => (
  <AbsoluteFill>
    {/* Scene A exits at 105, fade starts 82 */}
    <Sequence from={0}   durationInFrames={108}><SceneA /></Sequence>
    {/* Scene B enters at 105 (15-frame overlap with A), exits at 225 */}
    <Sequence from={105} durationInFrames={120}><SceneB /></Sequence>
    {/* Scene C enters at 210 (15-frame overlap with B) */}
    <Sequence from={210} durationInFrames={90}><SceneC /></Sequence>
    {/* Scene D enters at 285 — real app UI (cloud mode + data leak) */}
    <Sequence from={285} durationInFrames={120}><SceneD /></Sequence>
    {/* Scene E enters at 390 — side-by-side comparison */}
    <Sequence from={390} durationInFrames={150}><SceneE /></Sequence>
  </AbsoluteFill>
);

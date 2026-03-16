/**
 * Scene3 — Command & Council (0–8s, 240 frames)
 *
 * Shows the @persona interaction replacing the old 14-card directory.
 *
 * Phase 1  (0–45f)  : Glass input appears, user types "@health"
 * Phase 2  (35–115f): Command palette slides up with 3 personas
 * Phase 3  (100–175f): @health-coach is selected — light sweep effect
 * Phase 4  (160–240f): Activation — "Private Connection" badge + streaming begins
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// Design tokens — matches v2 StylePreview aesthetic
const T = {
  bg:          "#000000",
  purple:      "#7c3aed",
  purpleLight: "#a78bfa",
  glass:       "rgba(255,255,255,0.07)",
  glassBorder: "rgba(255,255,255,0.10)",
  white:       "#ffffff",
  whiteDim:    "rgba(255,255,255,0.55)",
  whiteSubtle: "rgba(255,255,255,0.28)",
  green:       "#22c55e",
  font:        "Inter, system-ui, -apple-system, sans-serif",
};

const PERSONAS = [
  { handle: "@health-coach",  icon: "🏥", desc: "Medical guidance & wellness",     active: true  },
  { handle: "@tax-navigator", icon: "📊", desc: "Tax strategy & filing support",   active: false },
  { handle: "@legal-advisor", icon: "⚖️", desc: "Legal questions & contracts",     active: false },
] as const;

const TYPED_TEXT = "@health-coach";

// Glass card — gradient border technique from StylePreview v2
const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: boolean;
}> = ({ children, style, glow }) => (
  <div style={{
    background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)",
    borderRadius: 17,
    padding: 1,
    boxShadow: glow
      ? `0 0 60px rgba(124,58,237,0.25), 0 24px 60px rgba(0,0,0,0.5)`
      : `0 24px 60px rgba(0,0,0,0.5)`,
    ...style,
  }}>
    <div style={{
      background: T.glass,
      borderRadius: 16,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      height: "100%",
    }}>
      {children}
    </div>
  </div>
);

// Violet radial pool of light
const VoidDepth: React.FC = () => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    background: [
      "radial-gradient(ellipse 800px 600px at 50% 45%, rgba(124,58,237,0.18) 0%, transparent 65%)",
      "radial-gradient(ellipse 400px 300px at 50% 45%, rgba(167,139,250,0.08) 0%, transparent 55%)",
    ].join(", "),
  }} />
);

export const Scene3Council: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Phase 1: input field ── */
  const inputSpring = spring({ frame, fps, config: { mass: 0.5, damping: 13, stiffness: 90 } });
  const inputY  = interpolate(inputSpring, [0, 1], [30, 0]);
  const inputOp = interpolate(inputSpring, [0, 1], [0, 1]);

  // Characters typed
  const typeStart = 10;
  const typedCount = Math.floor(interpolate(frame, [typeStart, typeStart + 28], [0, TYPED_TEXT.length], clamp));
  const typedText  = TYPED_TEXT.slice(0, typedCount);
  const atGlow     = typedCount > 0 ? 1 : 0;

  /* ── Phase 2: command palette ── */
  const paletteStart = 35;
  const paletteSpr = spring({
    frame: Math.max(0, frame - paletteStart),
    fps,
    config: { mass: 0.5, damping: 14, stiffness: 100 },
  });
  const paletteY  = interpolate(paletteSpr, [0, 1], [40, 0]);
  const paletteOp = interpolate(paletteSpr, [0, 1], [0, 1]);

  /* ── Phase 3: selection sweep ── */
  const sweepStart = 100;
  const sweepProgress = interpolate(frame, [sweepStart, sweepStart + 45], [0, 1], clamp);
  // Light sweep x position across the active row
  const sweepX = interpolate(sweepProgress, [0, 1], [-200, 700]);

  /* ── Phase 4: activation ── */
  const activateStart = 162;
  const badgeSpr = spring({
    frame: Math.max(0, frame - activateStart),
    fps,
    config: { mass: 0.5, damping: 12, stiffness: 95 },
  });
  const badgeScale = interpolate(badgeSpr, [0, 1], [0.6, 1]);
  const badgeOp    = interpolate(badgeSpr, [0, 1], [0, 1]);

  // Palette collapses as badge appears
  const paletteCollapse = interpolate(frame, [activateStart - 10, activateStart + 20], [1, 0], clamp);
  const inputCollapse   = interpolate(frame, [activateStart - 5,  activateStart + 25], [1, 0], clamp);

  // Streaming text after activation
  const streamStart = 185;
  const STREAM_TEXT = "Based on your situation, here are safe options to manage blood sugar and reduce insulin costs — all advice reviewed without ever sharing your identity with any server.";
  const streamCount = Math.floor(interpolate(frame, [streamStart, streamStart + 110], [0, STREAM_TEXT.length], clamp));
  const streamText  = STREAM_TEXT.slice(0, streamCount);
  const streamOp    = interpolate(frame, [streamStart, streamStart + 12], [0, 1], clamp);

  // "Private Connection" badge text label opacity
  const privLabelOp = interpolate(frame, [activateStart + 15, activateStart + 30], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: T.bg,
      fontFamily: T.font,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
    }}>
      <VoidDepth />

      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.028 }}>
        <filter id="g3"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g3)" />
      </svg>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        width: 620,
        position: "relative",
      }}>

        {/* ── INPUT FIELD ── */}
        <div style={{
          opacity: inputOp * inputCollapse,
          transform: `translateY(${inputY}px)`,
          width: "100%",
          zIndex: 10,
        }}>
          <GlassCard glow style={{ width: "100%" }}>
            <div style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              {/* @ symbol with glow */}
              <span style={{
                fontSize: 18,
                fontWeight: 800,
                color: T.purpleLight,
                textShadow: atGlow > 0 ? `0 0 12px ${T.purpleLight}` : "none",
                transition: "text-shadow 0.2s",
                letterSpacing: "-0.02em",
              }}>
                @
              </span>
              {/* Typed text */}
              <span style={{
                fontSize: 17,
                fontWeight: 600,
                color: T.white,
                letterSpacing: "-0.02em",
                flex: 1,
              }}>
                {typedText.startsWith("@") ? typedText.slice(1) : typedText}
                {typedCount < TYPED_TEXT.length && (
                  <span style={{ opacity: 0.7, animation: "blink 1s step-end infinite" }}>|</span>
                )}
              </span>
              {/* Keyboard hint */}
              <span style={{
                fontSize: 11,
                color: T.whiteSubtle,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 5,
                padding: "2px 7px",
                fontWeight: 600,
              }}>
                ↵
              </span>
            </div>
          </GlassCard>
        </div>

        {/* ── COMMAND PALETTE ── */}
        <div style={{
          opacity: paletteOp * paletteCollapse,
          transform: `translateY(${paletteY}px)`,
          width: "100%",
          marginTop: 8,
          zIndex: 9,
          overflow: "hidden",
        }}>
          <GlassCard style={{ width: "100%" }}>
            <div style={{ padding: "10px 8px" }}>
              {/* Label */}
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.whiteSubtle,
                padding: "4px 12px 8px",
              }}>
                Select Advisor
              </div>

              {/* Persona rows */}
              {PERSONAS.map((p, i) => {
                const rowOp = !p.active && sweepProgress > 0.3
                  ? interpolate(sweepProgress, [0.3, 0.7], [1, 0.35], clamp)
                  : 1;

                return (
                  <div key={p.handle} style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    borderRadius: 11,
                    background: p.active ? "rgba(124,58,237,0.15)" : "transparent",
                    border: p.active ? "1px solid rgba(124,58,237,0.25)" : "1px solid transparent",
                    marginBottom: i < PERSONAS.length - 1 ? 4 : 0,
                    overflow: "hidden",
                    opacity: rowOp,
                  }}>
                    {/* Light sweep on active row */}
                    {p.active && sweepProgress > 0 && sweepProgress < 1 && (
                      <div style={{
                        position: "absolute",
                        top: 0, bottom: 0,
                        width: 80,
                        left: sweepX,
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                        pointerEvents: "none",
                      }} />
                    )}

                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 10,
                      background: p.active ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                      boxShadow: p.active ? "0 0 16px rgba(124,58,237,0.4)" : "none",
                    }}>
                      {p.icon}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: p.active ? T.purpleLight : T.whiteDim,
                        letterSpacing: "-0.01em",
                      }}>
                        {p.handle}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: T.whiteSubtle,
                        marginTop: 1,
                      }}>
                        {p.desc}
                      </div>
                    </div>

                    {/* Active indicator */}
                    {p.active && (
                      <div style={{
                        width: 6, height: 6,
                        borderRadius: "50%",
                        background: T.purpleLight,
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${T.purpleLight}`,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {/* ── ACTIVATION: Private Connection badge ── */}
        {badgeOp > 0.01 && (
          <div style={{
            opacity: badgeOp,
            transform: `scale(${badgeScale})`,
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            width: "100%",
          }}>
            {/* Chat header badge */}
            <GlassCard glow style={{ width: "100%" }}>
              <div style={{
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "rgba(124,58,237,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 0 20px rgba(124,58,237,0.5)",
                }}>
                  🏥
                </div>
                <div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: T.white,
                    letterSpacing: "-0.01em",
                  }}>
                    @health-coach
                  </div>
                  <div style={{
                    fontSize: 11, color: T.whiteSubtle,
                    marginTop: 2,
                  }}>
                    Medical guidance &amp; wellness
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                {/* Private connection badge */}
                <div style={{
                  opacity: privLabelOp,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 8,
                  background: "rgba(34,197,94,0.10)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  fontSize: 10, fontWeight: 700,
                  color: T.green,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  🛡️ Private Connection
                </div>
              </div>
            </GlassCard>

            {/* Streaming response */}
            {streamOp > 0 && (
              <GlassCard style={{ width: "100%", opacity: streamOp }}>
                <div style={{
                  padding: "18px 20px",
                  fontSize: 14,
                  color: T.whiteDim,
                  lineHeight: 1.65,
                  letterSpacing: "-0.01em",
                  minHeight: 80,
                }}>
                  {streamText}
                  {streamCount < STREAM_TEXT.length && (
                    <span style={{ opacity: 0.55 }}>▌</span>
                  )}
                </div>
                {/* Bottom status bar */}
                <div style={{
                  padding: "8px 20px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: T.green,
                    boxShadow: `0 0 6px ${T.green}`,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: T.green,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}>
                    On-device processing · Your identity protected
                  </span>
                </div>
              </GlassCard>
            )}
          </div>
        )}

      </div>
    </AbsoluteFill>
  );
};

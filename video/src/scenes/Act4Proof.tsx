/**
 * Act 4 — The Proof (28–45s, 510 frames)
 *
 * Phase A (0–180f):  @health-coach command palette interaction
 * Phase B (170–510f): App mockup streaming answer with privacy indicators
 *                     "14 Specialized Advisors. Zero data leakage."
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { AppMockup } from "../components/AppMockup";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const T = {
  bg:          "#000000",
  purple:      "#7c3aed",
  purpleLight: "#a78bfa",
  glass:       "rgba(255,255,255,0.07)",
  white:       "#ffffff",
  whiteDim:    "rgba(255,255,255,0.55)",
  whiteSubtle: "rgba(255,255,255,0.28)",
  green:       "#22c55e",
  font:        "Inter, system-ui, -apple-system, sans-serif",
};

const PERSONAS = [
  { handle: "@health-coach",  icon: "🏥", desc: "Medical guidance & wellness",   active: true  },
  { handle: "@tax-navigator", icon: "📊", desc: "Tax strategy & filing support", active: false },
  { handle: "@legal-advisor", icon: "⚖️", desc: "Legal questions & contracts",   active: false },
] as const;

const GlassCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: boolean }> = ({ children, style, glow }) => (
  <div style={{
    background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)",
    borderRadius: 17,
    padding: 1,
    boxShadow: glow ? "0 0 60px rgba(124,58,237,0.25), 0 24px 60px rgba(0,0,0,0.5)" : "0 24px 60px rgba(0,0,0,0.5)",
    ...style,
  }}>
    <div style={{ background: T.glass, borderRadius: 16, backdropFilter: "blur(16px)", height: "100%" }}>
      {children}
    </div>
  </div>
);

// Phase A: Command palette
const PhaseA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const TYPED = "@health-coach";

  const inputSpr = spring({ frame, fps, config: { mass: 0.5, damping: 13, stiffness: 90 } });
  const inputY  = interpolate(inputSpr, [0, 1], [30, 0]);
  const inputOp = interpolate(inputSpr, [0, 1], [0, 1]);

  const typedCount = Math.floor(interpolate(frame, [8, 36], [0, TYPED.length], clamp));
  const typedText  = TYPED.slice(0, typedCount);

  const paletteSpr = spring({ frame: Math.max(0, frame - 32), fps, config: { mass: 0.5, damping: 14, stiffness: 100 } });
  const paletteY  = interpolate(paletteSpr, [0, 1], [40, 0]);
  const paletteOp = interpolate(paletteSpr, [0, 1], [0, 1]);

  const sweepProgress = interpolate(frame, [90, 135], [0, 1], clamp);
  const sweepX = interpolate(sweepProgress, [0, 1], [-200, 700]);

  const activateSpr = spring({ frame: Math.max(0, frame - 145), fps, config: { mass: 0.5, damping: 12, stiffness: 95 } });
  const badgeOp    = interpolate(activateSpr, [0, 1], [0, 1]);
  const badgeScale = interpolate(activateSpr, [0, 1], [0.6, 1]);
  const collapse   = interpolate(frame, [138, 162], [1, 0], clamp);

  const streamStart = 175;
  const STREAM = "Your question is being processed privately. Your name, health details, and financial information stay on your device — only the context reaches the AI.";
  const streamCount = Math.floor(interpolate(frame, [streamStart, streamStart + 90], [0, STREAM.length], clamp));
  const streamOp    = interpolate(frame, [streamStart, streamStart + 12], [0, 1], clamp);

  const privLabelOp = interpolate(frame, [160, 175], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: T.bg,
      fontFamily: T.font,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
    }}>
      {/* Violet glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 800px 600px at 50% 45%, rgba(124,58,237,0.18) 0%, transparent 65%)",
      }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: 620, position: "relative" }}>
        {/* Input */}
        <div style={{ opacity: inputOp * collapse, transform: `translateY(${inputY}px)`, width: "100%", zIndex: 10 }}>
          <GlassCard glow style={{ width: "100%" }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.purpleLight,
                textShadow: typedCount > 0 ? `0 0 12px ${T.purpleLight}` : "none" }}>@</span>
              <span style={{ fontSize: 17, fontWeight: 600, color: T.white, letterSpacing: "-0.02em", flex: 1 }}>
                {typedText.startsWith("@") ? typedText.slice(1) : typedText}
                {typedCount < TYPED.length && <span style={{ opacity: 0.6 }}>|</span>}
              </span>
              <span style={{ fontSize: 11, color: T.whiteSubtle, background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>↵</span>
            </div>
          </GlassCard>
        </div>

        {/* Palette */}
        <div style={{ opacity: paletteOp * collapse, transform: `translateY(${paletteY}px)`, width: "100%", marginTop: 8, zIndex: 9 }}>
          <GlassCard style={{ width: "100%" }}>
            <div style={{ padding: "10px 8px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.whiteSubtle, padding: "4px 12px 8px" }}>Select Advisor</div>
              {PERSONAS.map((p, i) => {
                const rowOp = !p.active && sweepProgress > 0.3
                  ? interpolate(sweepProgress, [0.3, 0.7], [1, 0.32], clamp) : 1;
                return (
                  <div key={p.handle} style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px", borderRadius: 11, marginBottom: i < 2 ? 4 : 0,
                    background: p.active ? "rgba(124,58,237,0.15)" : "transparent",
                    border: p.active ? "1px solid rgba(124,58,237,0.25)" : "1px solid transparent",
                    overflow: "hidden", opacity: rowOp,
                  }}>
                    {p.active && sweepProgress > 0 && sweepProgress < 1 && (
                      <div style={{
                        position: "absolute", top: 0, bottom: 0, width: 80, left: sweepX,
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                        pointerEvents: "none",
                      }} />
                    )}
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, fontSize: 20,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: p.active ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                      boxShadow: p.active ? "0 0 16px rgba(124,58,237,0.4)" : "none" }}>{p.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: p.active ? T.purpleLight : T.whiteDim, letterSpacing: "-0.01em" }}>{p.handle}</div>
                      <div style={{ fontSize: 12, color: T.whiteSubtle, marginTop: 1 }}>{p.desc}</div>
                    </div>
                    {p.active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.purpleLight, flexShrink: 0, boxShadow: `0 0 8px ${T.purpleLight}` }} />}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {/* Activation */}
        {badgeOp > 0.01 && (
          <div style={{ opacity: badgeOp, transform: `scale(${badgeScale})`, marginTop: 28, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <GlassCard glow style={{ width: "100%" }}>
              <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, fontSize: 22, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(124,58,237,0.25)", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }}>🏥</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.white, letterSpacing: "-0.01em" }}>@health-coach</div>
                  <div style={{ fontSize: 11, color: T.whiteSubtle, marginTop: 2 }}>Medical guidance & wellness</div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ opacity: privLabelOp, display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 8, background: "rgba(34,197,94,0.10)",
                  border: "1px solid rgba(34,197,94,0.25)", fontSize: 10, fontWeight: 700,
                  color: T.green, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  🛡️ Private Connection
                </div>
              </div>
            </GlassCard>

            {streamOp > 0 && (
              <GlassCard style={{ width: "100%", opacity: streamOp }}>
                <div style={{ padding: "18px 20px", fontSize: 14, color: T.whiteDim, lineHeight: 1.65, minHeight: 72 }}>
                  {STREAM.slice(0, streamCount)}
                  {streamCount < STREAM.length && <span style={{ opacity: 0.55 }}>▌</span>}
                </div>
                <div style={{ padding: "8px 20px 12px", display: "flex", alignItems: "center", gap: 6,
                  borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Local Processing · Identity Protected
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

// Phase B: App mockup + advisors headline
const PhaseB: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appSpr = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 75 } });
  const appOp = interpolate(appSpr, [0, 1], [0, 1]);
  const appY  = interpolate(appSpr, [0, 1], [40, 0]);

  const headlineOp = interpolate(frame, [60, 85], [0, 1], clamp);

  // 14 advisor icons in a compact grid
  const ICONS = ["🏥","📊","⚖️","💰","🧠","❤️","🏋️","🍎","🎓","🏠","🌍","⚕️","💼","🔬"];
  const iconBaseOp = interpolate(frame, [90, 120], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: T.bg,
      fontFamily: T.font,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 36,
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 1000px 700px at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 68%)",
      }} />

      {/* App mockup */}
      <div style={{ opacity: appOp, transform: `translateY(${appY}px)` }}>
        <AppMockup frame={Math.max(0, frame - 20)} fps={fps} mode="sovereign" messageStage={2} scale={0.60} />
      </div>

      {/* Headline + 14 icons */}
      <div style={{ opacity: headlineOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em", textAlign: "center" }}>
          14 Specialized Advisors.{" "}
          <span style={{ color: "#a78bfa" }}>Zero data leakage.</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 640 }}>
          {ICONS.map((icon, i) => {
            const op = iconBaseOp * interpolate(frame, [90 + i * 6, 106 + i * 6], [0, 1], clamp);
            return (
              <div key={i} style={{
                opacity: op,
                width: 44, height: 44, borderRadius: 11,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {icon}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act4Proof: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={0}   durationInFrames={195}><PhaseA /></Sequence>
    <Sequence from={188} durationInFrames={322}><PhaseB /></Sequence>
  </AbsoluteFill>
);

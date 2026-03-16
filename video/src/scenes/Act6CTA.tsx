/**
 * Act 6 — The CTA (55–60s, 150 frames)
 *
 * Shield + "Sovereign AI" brand.
 * "Take back your data."
 * Large download button with pulsing glow.
 * URL: sovereign-ai-app.netlify.app
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

const font = "Inter, system-ui, -apple-system, sans-serif";

const ShieldSVG: React.FC<{ size: number; glowOpacity: number }> = ({ size, glowOpacity }) => (
  <svg width={size} height={size * 1.12} viewBox="0 0 100 112"
    style={{ filter: `drop-shadow(0 0 ${28 * glowOpacity}px rgba(124,58,237,${glowOpacity})) drop-shadow(0 0 ${56 * glowOpacity}px rgba(124,58,237,${glowOpacity * 0.5}))` }}>
    <defs>
      <linearGradient id="sg6" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ffffff" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <path d="M50 4 L88 20 L88 58 C88 80 68 96 50 104 C32 96 12 80 12 58 L12 20 Z"
      fill="rgba(124,58,237,0.14)" stroke="url(#sg6)" strokeWidth="2" />
    <rect x="38" y="52" width="24" height="20" rx="3" fill="url(#sg6)" />
    <path d="M42 52 L42 46 C42 38 58 38 58 46 L58 52"
      fill="none" stroke="url(#sg6)" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="50" cy="62" r="3" fill="#000" />
  </svg>
);

export const Act6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shield + brand entrance
  const brandSpr = spring({ frame, fps, config: { mass: 0.5, damping: 13, stiffness: 80 } });
  const brandOp  = interpolate(brandSpr, [0, 1], [0, 1]);
  const brandY   = interpolate(brandSpr, [0, 1], [24, 0]);

  const glowPulse = 0.7 + 0.3 * Math.sin(frame * 0.12);

  // Tagline
  const tagOp = interpolate(frame, [28, 48], [0, 1], clamp);
  const tagY  = interpolate(
    spring({ frame: Math.max(0, frame - 28), fps, config: { mass: 0.4, damping: 12, stiffness: 90 } }),
    [0, 1], [16, 0],
  );

  // Download button
  const btnSpr = spring({ frame: Math.max(0, frame - 55), fps, config: { mass: 0.4, damping: 12, stiffness: 90 } });
  const btnOp  = interpolate(btnSpr, [0, 1], [0, 1]);
  const btnY   = interpolate(btnSpr, [0, 1], [20, 0]);

  // Button light sweep
  const sweepX = interpolate(frame, [90, 145], [-130, 480], clamp);

  // URL fade
  const urlOp = interpolate(frame, [80, 100], [0, 1], clamp);

  // Background glow builds
  const bgOp = interpolate(frame, [0, 40], [0, 1], clamp);

  // Feature pills
  const pillsOp = interpolate(frame, [60, 80], [0, 1], clamp);
  const PILLS = ["🏥 Health", "📊 Finance", "⚖️ Legal", "🧠 Mental Wellness", "💼 Career"];

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: font,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 28,
    }}>
      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025 }}>
        <filter id="g6"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g6)" />
      </svg>

      {/* Violet radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: bgOp,
        background: [
          "radial-gradient(ellipse 900px 700px at 50% 44%, rgba(124,58,237,0.20) 0%, transparent 65%)",
          "radial-gradient(ellipse 400px 300px at 50% 44%, rgba(167,139,250,0.10) 0%, transparent 55%)",
        ].join(", "),
      }} />

      {/* Shield + brand */}
      <div style={{ opacity: brandOp, transform: `translateY(${brandY}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, zIndex: 1 }}>
        <ShieldSVG size={80} glowOpacity={glowPulse} />
        <div style={{
          fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #ffffff 30%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Sovereign AI
        </div>
      </div>

      {/* Tagline */}
      <div style={{ opacity: tagOp, transform: `translateY(${tagY}px)`, textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.80)", letterSpacing: "-0.01em" }}>
          Take back your data.
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ opacity: pillsOp, display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "center", zIndex: 1 }}>
        {PILLS.map((p, i) => {
          const pOp = interpolate(frame, [62 + i * 6, 78 + i * 6], [0, 1], clamp);
          return (
            <div key={i} style={{
              opacity: pOp,
              padding: "5px 12px", borderRadius: 100,
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              fontSize: 12, fontWeight: 600, color: "#a78bfa",
            }}>
              {p}
            </div>
          );
        })}
      </div>

      {/* Download button */}
      <div style={{
        opacity: btnOp, transform: `translateY(${btnY}px)`,
        position: "relative", overflow: "hidden",
        background: "#7c3aed",
        borderRadius: 100,
        padding: "18px 60px",
        boxShadow: `0 0 ${40 + 20 * glowPulse}px rgba(124,58,237,0.50), 0 0 14px rgba(124,58,237,0.30)`,
        cursor: "pointer",
        zIndex: 1,
      }}>
        {/* Light sweep */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, width: 90,
          left: sweepX,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent)",
          pointerEvents: "none",
        }} />
        <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", position: "relative" }}>
          Download for Desktop — Free
        </span>
      </div>

      {/* URL */}
      <div style={{ opacity: urlOp, fontSize: 14, color: "rgba(255,255,255,0.32)", letterSpacing: "0.01em", zIndex: 1 }}>
        sovereign-ai-app.netlify.app
      </div>
    </AbsoluteFill>
  );
};

/**
 * Act 3 — The Turn (18–28s, 300 frames)
 *
 * Sharp cut to black. Shield logo glows violet.
 * "Sovereign AI. Local. Private. Yours."
 * A "Start Private Chat" button with light-sweep CTA.
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

const ShieldSVG: React.FC<{ size: number; glowOpacity: number }> = ({ size, glowOpacity }) => (
  <svg width={size} height={size * 1.12} viewBox="0 0 100 112"
    style={{ filter: `drop-shadow(0 0 ${32 * glowOpacity}px rgba(124,58,237,${glowOpacity})) drop-shadow(0 0 ${60 * glowOpacity}px rgba(124,58,237,${glowOpacity * 0.5}))` }}>
    <defs>
      <linearGradient id="sg3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ffffff" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <path d="M50 4 L88 20 L88 58 C88 80 68 96 50 104 C32 96 12 80 12 58 L12 20 Z"
      fill="rgba(124,58,237,0.14)" stroke="url(#sg3)" strokeWidth="2" />
    <rect x="38" y="52" width="24" height="20" rx="3" fill="url(#sg3)" />
    <path d="M42 52 L42 46 C42 38 58 38 58 46 L58 52"
      fill="none" stroke="url(#sg3)" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="50" cy="62" r="3" fill="#000" />
  </svg>
);

export const Act3Turn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shield entrance
  const shieldSpr = spring({ frame, fps, config: { mass: 0.5, damping: 13, stiffness: 80 } });
  const shieldScale = interpolate(shieldSpr, [0, 1], [0.5, 1]);
  const shieldOp    = interpolate(shieldSpr, [0, 1], [0, 1]);

  // Glow builds up
  const glowOp = interpolate(frame, [0, 60], [0, 1], clamp);
  const glowPulse = glowOp * (0.75 + 0.25 * Math.sin(frame * 0.10));

  // Violet radial background
  const bgOp = interpolate(frame, [0, 40], [0, 1], clamp);

  // Brand name
  const brandOp = interpolate(frame, [40, 62], [0, 1], clamp);
  const brandY  = interpolate(
    spring({ frame: Math.max(0, frame - 40), fps, config: { mass: 0.4, damping: 12, stiffness: 90 } }),
    [0, 1], [18, 0],
  );

  // Tagline words appear staggered
  const tag1Op = interpolate(frame, [80, 98],  [0, 1], clamp);
  const tag2Op = interpolate(frame, [95, 113], [0, 1], clamp);
  const tag3Op = interpolate(frame, [110, 128],[0, 1], clamp);

  // CTA button
  const btnSpr = spring({ frame: Math.max(0, frame - 155), fps, config: { mass: 0.4, damping: 12, stiffness: 100 } });
  const btnOp  = interpolate(btnSpr, [0, 1], [0, 1]);
  const btnY   = interpolate(btnSpr, [0, 1], [20, 0]);

  // Light sweep across button
  const sweepX = interpolate(frame, [200, 270], [-120, 420], clamp);

  // Orbiting particle ring
  const orbitAngle = (frame / 300) * Math.PI * 2;
  const ORBIT_R = 130;
  const particleCount = 8;

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 32,
    }}>
      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025 }}>
        <filter id="g3t"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g3t)" />
      </svg>

      {/* Violet radial bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: bgOp,
        background: [
          "radial-gradient(ellipse 900px 600px at 50% 42%, rgba(124,58,237,0.22) 0%, transparent 65%)",
          "radial-gradient(ellipse 400px 300px at 50% 42%, rgba(167,139,250,0.10) 0%, transparent 55%)",
        ].join(", "),
      }} />

      {/* Orbiting particles */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: bgOp * 0.5 }}>
        {Array.from({ length: particleCount }).map((_, i) => {
          const angle = orbitAngle + (i / particleCount) * Math.PI * 2;
          const px = 960 + Math.cos(angle) * ORBIT_R;
          const py = 440 + Math.sin(angle) * ORBIT_R * 0.45;
          return (
            <circle key={i} cx={px} cy={py} r={2.5}
              fill="#a78bfa"
              opacity={0.4 + 0.3 * Math.sin(angle + frame * 0.05)}
            />
          );
        })}
      </svg>

      {/* Shield */}
      <div style={{
        transform: `scale(${shieldScale})`,
        opacity: shieldOp,
        zIndex: 1,
      }}>
        <ShieldSVG size={130} glowOpacity={glowPulse} />
      </div>

      {/* Brand name */}
      <div style={{
        opacity: brandOp,
        transform: `translateY(${brandY}px)`,
        textAlign: "center",
        zIndex: 1,
      }}>
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #ffffff 30%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Sovereign AI
        </div>
      </div>

      {/* Three-word tagline */}
      <div style={{
        display: "flex",
        gap: 20,
        alignItems: "center",
        zIndex: 1,
        marginTop: -8,
      }}>
        {[
          { word: "Local.",   op: tag1Op, color: "#22c55e" },
          { word: "Private.", op: tag2Op, color: "#a78bfa" },
          { word: "Yours.",   op: tag3Op, color: "#ffffff" },
        ].map(({ word, op, color }) => (
          <span key={word} style={{
            opacity: op,
            fontSize: 26,
            fontWeight: 600,
            color,
            letterSpacing: "-0.01em",
          }}>
            {word}
          </span>
        ))}
      </div>

      {/* CTA button */}
      <div style={{
        opacity: btnOp,
        transform: `translateY(${btnY}px)`,
        marginTop: 16,
        position: "relative",
        overflow: "hidden",
        background: "#7c3aed",
        borderRadius: 100,
        padding: "16px 52px",
        boxShadow: "0 0 40px rgba(124,58,237,0.45), 0 0 12px rgba(124,58,237,0.3)",
        cursor: "pointer",
        zIndex: 1,
      }}>
        {/* Light sweep */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, width: 80,
          left: sweepX,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
          pointerEvents: "none",
        }} />
        <span style={{
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          position: "relative",
        }}>
          Start Private Chat
        </span>
      </div>
    </AbsoluteFill>
  );
};

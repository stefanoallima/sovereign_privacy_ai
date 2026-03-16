/**
 * Act 2 — The Problem (8–18s, 300 frames)
 *
 * The questions fly toward a pulsing red cloud.
 * "Every word is training data. Every secret is a profile."
 * Glitch — targeted ads flash in.
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

const QUESTIONS = [
  { text: "I think I might be sick...",       startX: -700, startY: -200 },
  { text: "My bank balance is €240.",          startX:  700, startY: -150 },
  { text: "Am I being underpaid at €65k?",     startX: -600, startY:  180 },
  { text: "I haven't told my doctor this...",  startX:  650, startY:  200 },
];

const ADS = [
  { text: "High-interest loans — apply now",       x: -520, y: -180, delay: 185 },
  { text: "Health insurance from €29/month",       x:  480, y: -140, delay: 200 },
  { text: "Debt counselling — free consultation",  x: -480, y:  160, delay: 215 },
];

export const Act2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cloud entrance
  const cloudSpr = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 70 } });
  const cloudScale = interpolate(cloudSpr, [0, 1], [0.4, 1]);
  const cloudOp    = interpolate(cloudSpr, [0, 1], [0, 1]);

  // Cloud red pulse
  const cloudGlow = 0.35 + 0.15 * Math.sin(frame * 0.14);

  // Questions fly toward cloud center
  const qProgress = (i: number) =>
    interpolate(frame, [20 + i * 18, 90 + i * 18], [0, 1], clamp);

  // "Every word..." text
  const headlineOp = interpolate(frame, [130, 155], [0, 1], clamp);

  // Glitch overlay
  const glitchOp = interpolate(frame, [170, 176, 180, 186, 190], [0, 0.7, 0, 0.5, 0], clamp);

  // Ads
  const adOp = (delay: number) =>
    interpolate(frame, [delay, delay + 16], [0, 1], clamp);
  const adX = (delay: number, targetX: number) =>
    interpolate(
      spring({ frame: Math.max(0, frame - delay), fps, config: { mass: 0.4, damping: 12, stiffness: 110 } }),
      [0, 1], [targetX * 0.35 + 960, targetX + 960]
    );

  // "You are the product"
  const productOp = interpolate(frame, [240, 262], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025 }}>
        <filter id="g2"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g2)" />
      </svg>

      {/* Red ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 700px 500px at 50% 50%, rgba(239,68,68,${cloudGlow * 0.5}) 0%, transparent 65%)`,
      }} />

      {/* Cloud icon */}
      <div style={{
        position: "absolute",
        left: "50%", top: "50%",
        transform: `translate(-50%, -50%) scale(${cloudScale})`,
        opacity: cloudOp,
        fontSize: 120,
        filter: `drop-shadow(0 0 40px rgba(239,68,68,${cloudGlow}))`,
        userSelect: "none",
      }}>
        ☁️
      </div>

      {/* Questions flying toward cloud */}
      {QUESTIONS.map((q, i) => {
        const p  = qProgress(i);
        const x  = interpolate(p, [0, 1], [q.startX + 960, 960]);
        const y  = interpolate(p, [0, 1], [q.startY + 540, 540]);
        const op = interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
        const sc = interpolate(p, [0, 1], [1, 0.5]);
        if (op < 0.01) return null;
        return (
          <div key={i} style={{
            position: "absolute",
            left: x,
            top: y,
            transform: `translate(-50%, -50%) scale(${sc})`,
            opacity: op,
            fontSize: 22,
            fontWeight: 300,
            color: "rgba(255,255,255,0.75)",
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}>
            {q.text}
          </div>
        );
      })}

      {/* Headline */}
      <div style={{
        position: "absolute",
        bottom: 200,
        left: 0, right: 0,
        textAlign: "center",
        opacity: headlineOp,
      }}>
        <div style={{
          fontSize: 34,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          lineHeight: 1.3,
        }}>
          Every word is training data.
        </div>
        <div style={{
          fontSize: 34,
          fontWeight: 700,
          color: "rgba(239,68,68,0.90)",
          letterSpacing: "-0.02em",
          marginTop: 4,
        }}>
          Every secret is a profile.
        </div>
      </div>

      {/* Glitch overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "rgba(239,68,68,0.08)",
        opacity: glitchOp,
        boxShadow: "inset 4px 0 0 rgba(239,68,68,0.4), inset -4px 0 0 rgba(0,0,255,0.2)",
      }} />

      {/* Targeted ads */}
      {ADS.map((ad, i) => {
        const op = adOp(ad.delay);
        if (op < 0.01) return null;
        const x = adX(ad.delay, ad.x);
        return (
          <div key={i} style={{
            position: "absolute",
            left: x,
            top: ad.y + 540,
            transform: "translate(-50%, -50%)",
            opacity: op,
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            whiteSpace: "nowrap",
          }}>
            <div style={{
              background: "#fbbf24", borderRadius: 4,
              padding: "2px 6px", fontSize: 10,
              fontWeight: 800, color: "#000", letterSpacing: "0.05em",
            }}>
              AD
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", fontWeight: 500 }}>
              {ad.text}
            </span>
          </div>
        );
      })}

      {/* "You are the product" */}
      <div style={{
        position: "absolute",
        bottom: 110,
        left: 0, right: 0,
        textAlign: "center",
        opacity: productOp,
        fontSize: 15,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.06em",
        fontStyle: "italic",
      }}>
        You are their training data. You are their product.
      </div>
    </AbsoluteFill>
  );
};

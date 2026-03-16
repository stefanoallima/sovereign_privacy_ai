/**
 * Scene4 — The Sovereign Answer (17–29s, 360 frames)
 *
 * Closes the loop from Scene1 (the threat) by showing the same health question
 * now answered safely inside the Sovereign AI app. The AppMockup in sovereign
 * mode shows the real UI with the Anonymized badge and privacy header.
 *
 *   0–40f   : App slides in, "With Sovereign AI" label fades up
 *   30–200f : Response streams into the assistant bubble
 *   180–360f: Privacy detail cards animate in below the app
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppMockup } from "../components/AppMockup";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const PRIVACY_POINTS = [
  { icon: "🔍", text: "Your name & health details detected automatically" },
  { icon: "🔒", text: "Replaced with safe placeholders before leaving device" },
  { icon: "✅", text: "AI answers with full context — you keep your identity" },
] as const;

export const Scene4Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // App entrance
  const appSpring = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 80 } });
  const appY  = interpolate(appSpring, [0, 1], [50, 0]);
  const appOp = interpolate(appSpring, [0, 1], [0, 1]);

  // Label
  const labelOp = interpolate(frame, [12, 28], [0, 1], clamp);

  // Violet background glow
  const glowOp = interpolate(frame, [0, 60], [0, 1], clamp);

  // Privacy points stagger in
  const pointOp = (i: number) =>
    interpolate(frame, [185 + i * 20, 205 + i * 20], [0, 1], clamp);
  const pointX = (i: number) =>
    interpolate(
      spring({ frame: Math.max(0, frame - 185 - i * 20), fps, config: { mass: 0.4, damping: 12, stiffness: 100 } }),
      [0, 1], [30, 0]
    );

  // Tagline
  const tagOp = interpolate(frame, [290, 316], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 48,
    }}>
      {/* Violet radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: glowOp,
        background: "radial-gradient(ellipse 1100px 700px at 50% 50%, rgba(124,58,237,0.13) 0%, transparent 70%)",
      }} />

      {/* Left column: label + app */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: appOp,
        transform: `translateY(${appY}px)`,
      }}>
        <div style={{
          opacity: labelOp,
          fontSize: 12, fontWeight: 700,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: "rgba(167,139,250,0.85)",
        }}>
          Same question — fully protected
        </div>

        <AppMockup
          frame={Math.max(0, frame - 28)}
          fps={fps}
          mode="sovereign"
          messageStage={2}
          assistantTypeFrame={Math.max(0, frame - 40)}
          scale={0.65}
        />
      </div>

      {/* Right column: privacy detail cards */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: 380,
      }}>
        {PRIVACY_POINTS.map((p, i) => (
          <div key={i} style={{
            opacity: pointOp(i),
            transform: `translateX(${pointX(i)}px)`,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{p.icon}</span>
            <span style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.45,
              fontWeight: 500,
            }}>
              {p.text}
            </span>
          </div>
        ))}

        {/* Tagline */}
        <div style={{
          opacity: tagOp,
          marginTop: 8,
          fontSize: 22,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          lineHeight: 1.3,
        }}>
          Powerful AI.{" "}
          <span style={{ color: "#a78bfa" }}>Zero exposure.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene5DataSplit (29–37s, frames 870–1110, 240 frames)
 *
 * Side-by-side comparison:
 *   Left  : AppMockup in cloud mode    — "Cloud Standard" badge, red glow
 *   Right : AppMockup in sovereign mode — "Anonymized" badge, green/violet glow
 *
 *   0–30f  : both panels slide in from their sides
 *   30–60f : labels appear
 *   60–200f: app content fully visible, divider glow pulses
 *   200–240f: bottom tagline fades in
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

export const Scene5DataSplit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left panel slides in from left
  const leftSpring = spring({ frame, fps, config: { mass: 0.7, damping: 14, stiffness: 80 } });
  const leftX = interpolate(leftSpring, [0, 1], [-120, 0]);
  const leftOp = interpolate(leftSpring, [0, 1], [0, 1]);

  // Right panel slides in from right (slight delay)
  const rightSpring = spring({ frame: Math.max(0, frame - 8), fps, config: { mass: 0.7, damping: 14, stiffness: 80 } });
  const rightX = interpolate(rightSpring, [0, 1], [120, 0]);
  const rightOp = interpolate(rightSpring, [0, 1], [0, 1]);

  // Labels
  const labelOp = interpolate(frame, [25, 45], [0, 1], clamp);

  // Divider glow pulse
  const dividerGlow = 4 + Math.sin(frame * 0.18) * 3;

  // Bottom tagline
  const taglineOp = interpolate(frame, [200, 225], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "row",
      overflow: "hidden",
    }}>
      {/* Left background tint — red (cloud / threat) */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: "50%",
        background: "radial-gradient(ellipse 700px 800px at 0% 50%, rgba(239,68,68,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Right background tint — violet (sovereign / safe) */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, right: 0, width: "50%",
        background: "radial-gradient(ellipse 700px 800px at 100% 50%, rgba(124,58,237,0.1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: leftOp,
        transform: `translateX(${leftX}px)`,
        paddingLeft: 24,
      }}>
        {/* Label */}
        <div style={{
          opacity: labelOp,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(239,68,68,0.75)",
        }}>
          Without Sovereign AI
        </div>

        <AppMockup
          frame={Math.max(0, frame - 20)}
          fps={fps}
          mode="cloud"
          messageStage={2}
          scale={0.56}
        />
      </div>

      {/* ── DIVIDER ── */}
      <svg width={4} height={1080} style={{ flexShrink: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="transparent" />
            <stop offset="25%"  stopColor="rgba(124,58,237,0.6)" />
            <stop offset="75%"  stopColor="rgba(124,58,237,0.6)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <line
          x1={2} y1={0} x2={2} y2={1080}
          stroke="url(#divGrad)"
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 ${dividerGlow}px rgba(124,58,237,0.8))` }}
        />
      </svg>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: rightOp,
        transform: `translateX(${rightX}px)`,
        paddingRight: 24,
      }}>
        {/* Label */}
        <div style={{
          opacity: labelOp,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(124,58,237,0.85)",
        }}>
          With Sovereign AI
        </div>

        <AppMockup
          frame={Math.max(0, frame - 20)}
          fps={fps}
          mode="sovereign"
          messageStage={2}
          scale={0.56}
        />
      </div>

      {/* ── BOTTOM TAGLINE ── */}
      <div style={{
        position: "absolute",
        bottom: 56,
        left: 0, right: 0,
        textAlign: "center",
        fontSize: 28,
        fontWeight: 700,
        color: "rgba(255,255,255,0.9)",
        letterSpacing: "-0.02em",
        opacity: taglineOp,
      }}>
        Powerful models get the context.{" "}
        <span style={{ color: "#a78bfa" }}>You keep the identity.</span>
      </div>
    </AbsoluteFill>
  );
};

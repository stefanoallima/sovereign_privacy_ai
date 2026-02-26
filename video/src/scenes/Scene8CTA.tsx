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

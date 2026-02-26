import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ShieldLogo } from "../components/ShieldLogo";
import { TypewriterText } from "../components/TypewriterText";
import { COLORS } from "../constants/colors";

export const Scene2Turn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flashOpacity = interpolate(frame, [0, 3, 8], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { stiffness: 55, damping: 11 },
  });

  const contentOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

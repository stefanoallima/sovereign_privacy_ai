import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TechBadge } from "../components/TechBadge";
import { COLORS } from "../constants/colors";

const BADGES = [
  { label: "Tauri 2",   color: COLORS.tauri  },
  { label: "Rust",      color: COLORS.rust   },
  { label: "React 19",  color: COLORS.react  },
  { label: "GLiNER",    color: COLORS.accent },
];

export const Scene7TechStack: React.FC = () => {
  const frame = useCurrentFrame();

  const subOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 48,
      }}
    >
      <div style={{ display: "flex", gap: 24 }}>
        {BADGES.map((b, i) => (
          <TechBadge key={b.label} label={b.label} color={b.color} index={i} startFrame={10} />
        ))}
      </div>

      <div
        style={{
          opacity: subOpacity,
          fontSize: 18,
          color: COLORS.textMuted,
          letterSpacing: "0.06em",
        }}
      >
        Open source &nbsp;·&nbsp; MIT License &nbsp;·&nbsp; Windows &amp; macOS
      </div>
    </AbsoluteFill>
  );
};

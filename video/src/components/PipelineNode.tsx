import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface Props {
  label: string;
  sublabel?: string;
  activateFrame: number;
  glowColor?: string;
  x: number;
  y: number;
  width?: number;
}

export const PipelineNode: React.FC<Props> = ({
  label,
  sublabel,
  activateFrame,
  glowColor = COLORS.accent,
  x,
  y,
  width = 180,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - activateFrame);

  const opacity = interpolate(local, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const glow = interpolate(local, [0, 10, 30], [0, 1, 0.3], { extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, 8], [0.85, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        background: `${glowColor}14`,
        border: `1.5px solid ${glowColor}`,
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: `0 0 ${glow * 24}px ${glowColor}`,
        fontFamily: "Inter, monospace",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: glowColor }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
};

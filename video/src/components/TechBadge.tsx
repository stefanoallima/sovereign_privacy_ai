import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  label: string;
  color: string;
  index: number;
  startFrame: number;
}

export const TechBadge: React.FC<Props> = ({ label, color, index, startFrame }) => {
  const frame = useCurrentFrame();
  const delay = index * 12;
  const localFrame = Math.max(0, frame - startFrame - delay);

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 15], [12, 0], {
    extrapolateRight: "clamp",
  });

  const glowIntensity = interpolate(localFrame, [20, 30, 40], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "10px 24px",
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 700,
        color,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 ${glowIntensity * 20}px ${color}`,
        fontFamily: "monospace",
        letterSpacing: "0.04em",
        background: `${color}10`,
      }}
    >
      {label}
    </div>
  );
};

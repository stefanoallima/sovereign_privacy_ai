import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

type Mode = "LOCAL" | "HYBRID" | "CLOUD";

interface Props {
  selected: Mode;
  activateFrame: number;
}

const MODES: Mode[] = ["LOCAL", "HYBRID", "CLOUD"];

export const ModeSelector: React.FC<Props> = ({ selected, activateFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - activateFrame);
  const appear = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        opacity: appear,
        transform: `scale(${0.9 + 0.1 * appear})`,
      }}
    >
      {MODES.map((mode) => {
        const isSelected = mode === selected;
        return (
          <div
            key={mode}
            style={{
              padding: "10px 28px",
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: isSelected ? "#fff" : COLORS.textMuted,
              background: isSelected ? COLORS.accent : "rgba(255,255,255,0.05)",
              border: `1px solid ${isSelected ? COLORS.accent : "rgba(255,255,255,0.12)"}`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {mode}
          </div>
        );
      })}
    </div>
  );
};

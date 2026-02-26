import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdvisorCard } from "../components/AdvisorCard";
import { ADVISORS } from "../constants/advisors";
import { COLORS } from "../constants/colors";

export const Scene3Council: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const sweepFrame = Math.max(0, frame - 132);
  const highlighted = sweepFrame > 0 ? [3, 7] : [];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "60px 80px",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.textMuted,
          letterSpacing: "0.04em",
        }}
      >
        Your Private Council
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        {ADVISORS.map((advisor, i) => (
          <div
            key={advisor.handle}
            style={{
              outline: highlighted.includes(i)
                ? `2px solid ${COLORS.accent}`
                : "2px solid transparent",
              borderRadius: 14,
              boxShadow: highlighted.includes(i)
                ? `0 0 20px ${COLORS.accent}44`
                : "none",
            }}
          >
            <AdvisorCard
              advisor={advisor}
              index={i}
              sceneStartFrame={0}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

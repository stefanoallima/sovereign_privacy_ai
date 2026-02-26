import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Advisor } from "../constants/advisors";
import { PrivacyBadge } from "./PrivacyBadge";
import { COLORS } from "../constants/colors";

interface Props {
  advisor: Advisor;
  index: number;
  sceneStartFrame: number;
}

export const AdvisorCard: React.FC<Props> = ({ advisor, index, sceneStartFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 8;
  const localFrame = Math.max(0, frame - sceneStartFrame - delay);

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 20], [20, 0], {
    extrapolateRight: "clamp",
  });
  const scale = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 120, damping: 14 },
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${Math.min(scale, 1)})`,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: 200,
      }}
    >
      <div style={{ fontSize: 28 }}>{advisor.icon}</div>
      <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>
        {advisor.handle}
      </div>
      <PrivacyBadge mode={advisor.privacy} />
    </div>
  );
};

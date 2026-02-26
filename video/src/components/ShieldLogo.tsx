import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/colors";

interface Props {
  size?: number;
  startFrame?: number;
}

export const ShieldLogo: React.FC<Props> = ({ size = 80, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - startFrame);

  const scale = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 60, damping: 12 },
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `scale(${scale})` }}
    >
      <path
        d="M50 5 L85 20 L85 55 C85 75 67 90 50 97 C33 90 15 75 15 55 L15 20 Z"
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="3"
      />
      <path
        d="M50 5 L85 20 L85 55 C85 75 67 90 50 97 C33 90 15 75 15 55 L15 20 Z"
        fill={`${COLORS.accent}18`}
      />
      <rect x="38" y="47" width="24" height="20" rx="3" fill={COLORS.accent} />
      <path
        d="M42 47 L42 42 C42 36 58 36 58 42 L58 47"
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="57" r="3" fill={COLORS.background} />
    </svg>
  );
};

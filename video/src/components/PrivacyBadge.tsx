import React from "react";
import { COLORS } from "../constants/colors";
import type { PrivacyMode } from "../constants/advisors";

const BADGE_COLORS: Record<PrivacyMode, string> = {
  LOCAL:  COLORS.safe,
  HYBRID: COLORS.accent,
  CLOUD:  COLORS.cloud,
};

interface Props {
  mode: PrivacyMode;
}

export const PrivacyBadge: React.FC<Props> = ({ mode }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: BADGE_COLORS[mode],
      border: `1px solid ${BADGE_COLORS[mode]}`,
      borderRadius: 4,
      padding: "2px 6px",
      fontFamily: "monospace",
    }}
  >
    {mode}
  </span>
);

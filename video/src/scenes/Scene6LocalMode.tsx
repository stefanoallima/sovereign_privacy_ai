import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ModeSelector } from "../components/ModeSelector";
import { COLORS } from "../constants/colors";

export const Scene6LocalMode: React.FC = () => {
  const frame = useCurrentFrame();

  const wifiOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  const tokenCount = Math.floor(interpolate(frame, [90, 230], [0, 40], { extrapolateRight: "clamp" }));
  const TOKENS = "The privacy pipeline protects your identity by running GLiNER locally. Zero network requests. Fully sovereign. All inference happens on your hardware.".split(" ");

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, system-ui, sans-serif",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 60,
      }}
    >
      <ModeSelector selected="LOCAL" activateFrame={10} />

      <div
        style={{
          opacity: wifiOpacity,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "rgba(239, 68, 68, 0.1)",
          border: `1px solid ${COLORS.danger}`,
          borderRadius: 12,
          padding: "12px 28px",
        }}
      >
        <span style={{ fontSize: 28 }}>📵</span>
        <div>
          <div style={{ color: COLORS.danger, fontWeight: 700 }}>Network: Disconnected</div>
          <div style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: "monospace" }}>
            ↑ 0 kbps &nbsp;&nbsp; ↓ 0 kbps
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "20px 32px",
          width: 800,
          minHeight: 80,
          fontSize: 16,
          color: COLORS.textPrimary,
          lineHeight: 1.7,
          fontFamily: "monospace",
          opacity: interpolate(frame, [88, 95], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {TOKENS.slice(0, tokenCount).join(" ")}
        {tokenCount < TOKENS.length && (
          <span style={{ opacity: 0.6 }}>▌</span>
        )}
      </div>
    </AbsoluteFill>
  );
};

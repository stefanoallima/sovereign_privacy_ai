import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

const LEFT_DATA = [
  "Jan de Vries",
  "BSN: 123-456-789",
  "Salary: €62,500",
  "Keizersgracht 42, Amsterdam",
];

const RIGHT_DATA = [
  "[PERSON]",
  "[IDENTIFIER]",
  "income_bracket: 50k–75k",
  "[ADDRESS]",
];

export const Scene5DataSplit: React.FC = () => {
  const frame = useCurrentFrame();

  const dividerHeight = interpolate(frame, [10, 40], [0, 1080], {
    extrapolateRight: "clamp",
  });

  const dividerGlow = 4 + Math.sin(frame * 0.15) * 3;

  const labelOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, monospace",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          padding: "80px 80px 80px 120px",
          background: `${COLORS.safe}08`,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            opacity: labelOpacity,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 24 }}>🔒</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.safe }}>
            What stays on your machine
          </span>
        </div>
        {LEFT_DATA.map((line, i) => {
          const lineOpacity = interpolate(frame, [40 + i * 15, 55 + i * 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineX = interpolate(frame, [40 + i * 15, 55 + i * 15], [-20, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                fontSize: 22,
                color: COLORS.textPrimary,
                fontWeight: 500,
                fontFamily: "monospace",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <svg width={4} height={1080} style={{ flexShrink: 0 }}>
        <line
          x1={2}
          y1={0}
          x2={2}
          y2={dividerHeight}
          stroke={COLORS.accent}
          strokeWidth={3}
          style={{ filter: `drop-shadow(0 0 ${dividerGlow}px ${COLORS.accent})` }}
        />
      </svg>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          padding: "80px 120px 80px 80px",
          background: `${COLORS.cloud}08`,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            opacity: labelOpacity,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 24 }}>☁️</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.cloud }}>
            What the cloud sees
          </span>
        </div>
        {RIGHT_DATA.map((line, i) => {
          const lineOpacity = interpolate(frame, [40 + i * 15, 55 + i * 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineX = interpolate(frame, [40 + i * 15, 55 + i * 15], [20, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateX(${lineX}px)`,
                fontSize: 22,
                color: COLORS.textMuted,
                fontWeight: 500,
                fontFamily: "monospace",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.textPrimary,
          opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Powerful models get the context.{" "}
        <span style={{ color: COLORS.accent }}>You keep the identity.</span>
      </div>
    </AbsoluteFill>
  );
};

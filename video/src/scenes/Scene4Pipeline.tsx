import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PipelineNode } from "../components/PipelineNode";
import { COLORS } from "../constants/colors";

const NODES: {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  color: string;
  activateFrame: number;
}[] = [
  { id: "msg",    label: "Your Message",      sublabel: undefined,         x: 160,  y: 320, color: COLORS.textMuted,  activateFrame: 10  },
  { id: "gliner", label: "GLiNER Shield",     sublabel: "PII detection",   x: 440,  y: 320, color: COLORS.safe,       activateFrame: 30  },
  { id: "router", label: "Backend Router",    sublabel: undefined,         x: 720,  y: 320, color: COLORS.accent,     activateFrame: 50  },
  { id: "attr",   label: "Attribute Extract", sublabel: "categories only", x: 960,  y: 560, color: COLORS.accent,     activateFrame: 70  },
  { id: "cloud",  label: "Cloud LLM",         sublabel: "EU-based",        x: 680,  y: 560, color: COLORS.cloud,      activateFrame: 90  },
  { id: "rehy",   label: "Rehydration",       sublabel: "local only",      x: 400,  y: 560, color: COLORS.safe,       activateFrame: 110 },
];

const PATH_D = "M 250 352 L 530 352 L 810 352 L 1050 592 L 770 592 L 490 592";

const PATH_POINTS = [
  { x: 250, y: 352 },
  { x: 530, y: 352 },
  { x: 810, y: 352 },
  { x: 1050, y: 592 },
  { x: 770, y: 592 },
  { x: 490, y: 592 },
];

// Utility: interpolate a point along a polyline by [0,1] progress
function getPointAlongPolyline(
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };

  const segments: { length: number; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segments.push({ length: len, p1: points[i], p2: points[i + 1] });
    total += len;
  }

  let target = t * total;
  for (const seg of segments) {
    if (target <= seg.length) {
      const ratio = target / seg.length;
      return {
        x: seg.p1.x + ratio * (seg.p2.x - seg.p1.x),
        y: seg.p1.y + ratio * (seg.p2.y - seg.p1.y),
      };
    }
    target -= seg.length;
  }
  return points[points.length - 1];
}

export const Scene4Pipeline: React.FC = () => {
  const frame = useCurrentFrame();

  const particleProgress = interpolate(frame, [130, 280], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineProgress = interpolate(frame, [10, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pathLength = 1500;
  const dashOffset = pathLength * (1 - lineProgress);

  const particleXY = getPointAlongPolyline(PATH_POINTS, particleProgress);

  const redactionProgress = interpolate(frame, [155, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bubbleOpacity = interpolate(frame, [220, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rehydrateProgress = interpolate(frame, [265, 285], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        fontFamily: "Inter, monospace",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.textMuted,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Privacy Pipeline
      </div>

      {/* SVG: connecting lines + particle */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Dotted path */}
        <path
          d={PATH_D}
          fill="none"
          stroke={COLORS.accent}
          strokeWidth={2}
          strokeDasharray={`${pathLength}`}
          strokeDashoffset={dashOffset}
          opacity={0.4}
        />

        {/* Traveling particle */}
        {particleProgress > 0 && particleProgress < 1 && (
          <circle
            cx={particleXY.x}
            cy={particleXY.y}
            r={7}
            fill={COLORS.accent}
            style={{ filter: `drop-shadow(0 0 8px ${COLORS.accent})` }}
          />
        )}

        {/* Blocked red path at Attribute Extract */}
        {frame > 200 && (
          <>
            <line x1={1050} y1={560} x2={1050} y2={490} stroke={COLORS.danger} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />
            <text x={1065} y={525} fill={COLORS.danger} fontSize={12} fontFamily="monospace">BSN: 123... ✕</text>
          </>
        )}
      </svg>

      {/* Pipeline nodes */}
      {NODES.map((n) => (
        <PipelineNode
          key={n.id}
          label={n.label}
          sublabel={n.sublabel}
          activateFrame={n.activateFrame}
          glowColor={n.color}
          x={n.x}
          y={n.y}
        />
      ))}

      {/* Redacted text near GLiNER node */}
      {frame > 140 && (
        <div
          style={{
            position: "absolute",
            left: 370,
            top: 270,
            fontSize: 12,
            fontFamily: "monospace",
            color: COLORS.safe,
            opacity: interpolate(frame, [140, 155], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {redactionProgress > 0.5
            ? "█████, BSN: █████████"
            : "€62,500, BSN: 123-456-789"}
        </div>
      )}

      {/* Cloud LLM response bubble */}
      {bubbleOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 580,
            top: 500,
            background: "rgba(107, 114, 128, 0.15)",
            border: `1px solid ${COLORS.cloud}`,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            color: COLORS.cloud,
            opacity: bubbleOpacity,
          }}
        >
          Your [INCOME] falls in the 40% bracket...
        </div>
      )}

      {/* Rehydrated response */}
      {rehydrateProgress > 0 && (
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 640,
            fontSize: 13,
            color: COLORS.safe,
            opacity: rehydrateProgress,
          }}
        >
          Your <strong>€62,500</strong> falls in the 40% bracket...
          <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.textMuted }}>← real values restored locally</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Scene7 — Why Sovereign AI (benefits, not tech)
 *
 * Four benefit cards stagger in, replacing the old tech-badge display.
 */

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants/colors";

const BENEFITS = [
  {
    icon: "🔒",
    headline: "Your data never leaves your device",
    sub: "Every conversation stays local — encrypted and private",
    color: "#22c55e",
  },
  {
    icon: "🛡️",
    headline: "Private info detected & hidden automatically",
    sub: "Name, salary, health details replaced before anything is sent",
    color: "#a78bfa",
  },
  {
    icon: "⚡",
    headline: "Works offline, instantly",
    sub: "No subscriptions, no cloud dependency, no waiting",
    color: "#38bdf8",
  },
  {
    icon: "👁️",
    headline: "Open source — nothing to hide",
    sub: "Free forever · MIT License · Windows & macOS",
    color: "#fb923c",
  },
] as const;

export const Scene7TechStack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: COLORS.background,
      fontFamily: "Inter, system-ui, sans-serif",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 48,
    }}>
      {/* Section label */}
      <div style={{
        opacity: titleOp,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.35)",
      }}>
        Why Sovereign AI
      </div>

      {/* Benefit cards */}
      <div style={{ display: "flex", gap: 20 }}>
        {BENEFITS.map((b, i) => {
          const cardSpring = spring({
            frame: Math.max(0, frame - 10 - i * 12),
            fps,
            config: { mass: 0.5, damping: 13, stiffness: 95 },
          });
          const cardY  = interpolate(cardSpring, [0, 1], [30, 0]);
          const cardOp = interpolate(cardSpring, [0, 1], [0, 1]);
          const glowPulse = 0.06 + 0.03 * Math.sin(frame * 0.12 + i * 1.4);

          return (
            <div key={i} style={{
              opacity: cardOp,
              transform: `translateY(${cardY}px)`,
              width: 280,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 16,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: `0 0 40px ${b.color}${Math.round(glowPulse * 255).toString(16).padStart(2,"0")}`,
            }}>
              <div style={{ fontSize: 36 }}>{b.icon}</div>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.35,
                letterSpacing: "-0.01em",
              }}>
                {b.headline}
              </div>
              <div style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.5,
              }}>
                {b.sub}
              </div>
              {/* Color accent bar at bottom */}
              <div style={{
                height: 2,
                borderRadius: 1,
                background: b.color,
                opacity: 0.6,
                marginTop: 4,
              }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

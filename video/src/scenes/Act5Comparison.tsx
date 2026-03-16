/**
 * Act 5 — The Comparison (45–55s, 300 frames)
 *
 * Split screen: Cloud AI (left) vs Sovereign AI (right).
 * Left: red "Unsecured" badge, data leaving device.
 * Right: violet "🔐 Anonymized" badge, data stays.
 * Copy: "Powerful intelligence. Absolute privacy."
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const font = "Inter, system-ui, -apple-system, sans-serif";

// Fake chat message rows
const MESSAGES = [
  { user: "Am I being underpaid at €65k?",        reply: "Based on your role and location…" },
  { user: "I haven't told my doctor this yet…",   reply: "That sounds difficult. Let's discuss…" },
];

const ChatPanel: React.FC<{
  side: "cloud" | "sovereign";
  frame: number;
  fps: number;
  entranceDelay: number;
}> = ({ side, frame, fps, entranceDelay }) => {
  const isCloud = side === "cloud";

  const panelSpr = spring({ frame: Math.max(0, frame - entranceDelay), fps, config: { mass: 0.5, damping: 14, stiffness: 80 } });
  const panelOp = interpolate(panelSpr, [0, 1], [0, 1]);
  const panelX  = interpolate(panelSpr, [0, 1], [isCloud ? -40 : 40, 0]);

  const badgeSpr = spring({ frame: Math.max(0, frame - entranceDelay - 30), fps, config: { mass: 0.4, damping: 12, stiffness: 110 } });
  const badgeOp  = interpolate(badgeSpr, [0, 1], [0, 1]);
  const badgeSc  = interpolate(badgeSpr, [0, 1], [0.7, 1]);

  const msgOp = interpolate(frame, [entranceDelay + 20, entranceDelay + 40], [0, 1], clamp);

  // Leaking data packets (cloud only)
  const packetProgress = interpolate(frame, [entranceDelay + 50, entranceDelay + 120], [0, 1], clamp);

  const accentColor  = isCloud ? "#ef4444" : "#7c3aed";
  const accentLight  = isCloud ? "#fca5a5" : "#a78bfa";
  const badgeText    = isCloud ? "⚠ Unsecured" : "🔐 Anonymized";
  const badgeBg      = isCloud ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)";
  const badgeBorder  = isCloud ? "rgba(239,68,68,0.35)" : "rgba(124,58,237,0.35)";
  const label        = isCloud ? "Cloud AI" : "Sovereign AI";

  return (
    <div style={{
      opacity: panelOp,
      transform: `translateX(${panelX}px)`,
      display: "flex", flexDirection: "column", gap: 16,
      width: 380,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${isCloud ? "rgba(239,68,68,0.2)" : "rgba(124,58,237,0.2)"}`,
        borderRadius: 14,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: isCloud ? "rgba(239,68,68,0.18)" : "rgba(124,58,237,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>
            {isCloud ? "☁️" : "🔒"}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{label}</span>
        </div>
        <div style={{
          opacity: badgeOp,
          transform: `scale(${badgeSc})`,
          padding: "4px 10px", borderRadius: 8,
          background: badgeBg, border: `1px solid ${badgeBorder}`,
          fontSize: 11, fontWeight: 700, color: accentLight,
          letterSpacing: "0.04em", textTransform: "uppercase" as const,
        }}>
          {badgeText}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        opacity: msgOp,
        display: "flex", flexDirection: "column", gap: 10,
        padding: "16px 18px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        backdropFilter: "blur(12px)",
      }}>
        {MESSAGES.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* User bubble */}
            <div style={{
              alignSelf: "flex-end",
              background: isCloud ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.18)",
              border: `1px solid ${isCloud ? "rgba(239,68,68,0.2)" : "rgba(124,58,237,0.25)"}`,
              borderRadius: "12px 12px 3px 12px",
              padding: "8px 12px",
              fontSize: 12, color: "rgba(255,255,255,0.85)", maxWidth: 260,
            }}>
              {m.user}
            </div>
            {/* Assistant bubble */}
            <div style={{
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "12px 12px 12px 3px",
              padding: "8px 12px",
              fontSize: 12, color: "rgba(255,255,255,0.65)", maxWidth: 260,
            }}>
              {m.reply}
            </div>
          </div>
        ))}
      </div>

      {/* Data flow indicator */}
      <div style={{
        opacity: interpolate(frame, [entranceDelay + 40, entranceDelay + 60], [0, 1], clamp),
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        background: isCloud ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.07)",
        border: `1px solid ${isCloud ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.20)"}`,
        borderRadius: 10,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: isCloud ? "#ef4444" : "#22c55e",
          boxShadow: `0 0 6px ${isCloud ? "#ef4444" : "#22c55e"}`,
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: isCloud ? "#fca5a5" : "#86efac" }}>
          {isCloud ? "Your data sent to cloud servers" : "Data stays on your device"}
        </span>
      </div>

      {/* Animated data packets leaking (cloud only) */}
      {isCloud && packetProgress > 0 && (
        <svg width={380} height={40} style={{ position: "absolute", bottom: -50, left: 0, opacity: 0.7 }}>
          {[0, 0.25, 0.5, 0.75].map((offset, i) => {
            const p = (packetProgress + offset) % 1;
            const x = interpolate(p, [0, 1], [20, 360]);
            const op = interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
            return (
              <circle key={i} cx={x} cy={20} r={3}
                fill="#ef4444" opacity={op * 0.6} />
            );
          })}
        </svg>
      )}
    </div>
  );
};

export const Act5Comparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dividerOp = interpolate(frame, [15, 35], [0, 1], clamp);
  const headlineOp = interpolate(frame, [200, 228], [0, 1], clamp);
  const subOp      = interpolate(frame, [230, 255], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: font,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 40,
    }}>
      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025 }}>
        <filter id="g5"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g5)" />
      </svg>

      {/* Subtle dual glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: [
          "radial-gradient(ellipse 500px 600px at 28% 48%, rgba(239,68,68,0.10) 0%, transparent 65%)",
          "radial-gradient(ellipse 500px 600px at 72% 48%, rgba(124,58,237,0.12) 0%, transparent 65%)",
        ].join(", "),
      }} />

      {/* Side-by-side panels */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
        <ChatPanel side="cloud"    frame={frame} fps={fps} entranceDelay={0}  />

        {/* Divider */}
        <div style={{
          opacity: dividerOp,
          width: 1, height: 320,
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.18), transparent)",
          margin: "0 32px",
          flexShrink: 0,
        }} />

        <ChatPanel side="sovereign" frame={frame} fps={fps} entranceDelay={18} />
      </div>

      {/* Headline */}
      <div style={{ opacity: headlineOp, textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #ffffff 30%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Powerful intelligence.
        </div>
        <div style={{ opacity: subOp, fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#a78bfa" }}>
          Absolute privacy.
        </div>
      </div>
    </AbsoluteFill>
  );
};

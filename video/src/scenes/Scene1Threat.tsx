/**
 * Scene1Threat (0–5s, 150 frames)
 *
 * The hook: someone types a sensitive health question into a generic cloud AI.
 * Data silently leaks to the cloud. Targeted ads appear.
 *
 *   0–50f  : Generic "Cloud AI" chat window, health question types in
 *   50–110f : Red data packets stream right → cloud symbol
 *   90–150f : Targeted ads slide in on the right
 *   120–150f: Tagline "Because you asked. Now they know."
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

const QUESTION =
  "I've been managing Type 2 diabetes. My insulin costs €340/month — any advice?";

const ADS = [
  { label: "Metformin 40% off — limited time",  tag: "AD" },
  { label: "Health plan for diabetics — compare now", tag: "AD" },
  { label: "Insulin alternatives — see options", tag: "AD" },
];

const PACKETS = [
  { y: 290, delay:  0, len: 110, spd: 1.10 },
  { y: 330, delay:  6, len:  80, spd: 1.00 },
  { y: 370, delay: 12, len: 130, spd: 1.15 },
  { y: 310, delay: 18, len:  90, spd: 0.95 },
  { y: 350, delay:  9, len: 100, spd: 1.05 },
  { y: 390, delay:  3, len:  70, spd: 1.08 },
] as const;

const PKT_START = 48;

export const Scene1Threat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chat window entrance
  const chatSpring = spring({ frame, fps, config: { mass: 0.5, damping: 14, stiffness: 90 } });
  const chatY  = interpolate(chatSpring, [0, 1], [40, 0]);
  const chatOp = interpolate(chatSpring, [0, 1], [0, 1]);

  // Typewriter for the question
  const charsToShow = Math.floor(interpolate(frame, [8, 55], [0, QUESTION.length], clamp));
  const visibleText = QUESTION.slice(0, charsToShow);

  // Red tint grows as packets flow
  const redTint = interpolate(frame, [48, 110], [0, 0.20], clamp);

  // Ads slide in one by one
  const adOpacity = (i: number) =>
    interpolate(frame, [92 + i * 14, 108 + i * 14], [0, 1], clamp);
  const adX = (i: number) =>
    interpolate(
      spring({ frame: Math.max(0, frame - 92 - i * 14), fps, config: { mass: 0.5, damping: 12, stiffness: 100 } }),
      [0, 1], [60, 0]
    );

  // Tagline
  const tagOp = interpolate(frame, [126, 142], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Red danger glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 1400px 900px at 50% 50%, rgba(239,68,68,${redTint}) 0%, transparent 70%)`,
      }} />

      {/* ── CLOUD AI CHAT WINDOW (left) ── */}
      <div style={{
        position: "absolute",
        left: 100,
        top: "50%",
        transform: `translateY(calc(-50% + ${chatY}px))`,
        opacity: chatOp,
        width: 580,
      }}>
        {/* Window chrome */}
        <div style={{
          background: "hsl(220,13%,18%)",
          borderRadius: "14px 14px 0 0",
          border: "1px solid hsl(220,13%,28%)",
          borderBottom: "none",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c, opacity: 0.9 }} />
          ))}
          <div style={{
            flex: 1, textAlign: "center", fontSize: 12,
            color: "rgba(255,255,255,0.4)", fontWeight: 500,
          }}>
            Cloud AI — New conversation
          </div>
        </div>

        {/* Chat body */}
        <div style={{
          background: "hsl(220,13%,20%)",
          border: "1px solid hsl(220,13%,28%)",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          padding: 24,
          minHeight: 160,
        }}>
          {/* User bubble */}
          <div style={{
            marginLeft: "auto",
            maxWidth: "85%",
            background: "hsla(199,89%,58%,0.14)",
            border: "1px solid hsla(199,89%,58%,0.25)",
            borderRadius: "14px 14px 4px 14px",
            padding: "10px 14px",
            fontSize: 14,
            color: "hsl(220,10%,93%)",
            lineHeight: 1.55,
            minHeight: 20,
          }}>
            {visibleText}
            {charsToShow < QUESTION.length && (
              <span style={{ opacity: 0.7 }}>|</span>
            )}
          </div>

          {/* "No privacy" label */}
          <div style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "flex-end",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 7,
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.25)",
              color: "#f59e0b",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
              opacity: charsToShow > 10 ? 1 : 0,
            }}>
              ☁️ No privacy protection
            </div>
          </div>
        </div>
      </div>

      {/* ── DATA PACKETS ── */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {PACKETS.map((p, i) => {
          const lf = frame - PKT_START - p.delay;
          if (lf <= 0) return null;
          const prog = Math.min(1, (lf / fps) * p.spd * 0.9);
          const startX = 700;
          const headX = startX + prog * (1250 - startX);
          const tailX = Math.max(startX, headX - p.len);
          const op = interpolate(prog, [0, 0.05, 0.85, 1], [0, 1, 1, 0], clamp);
          return (
            <g key={i}>
              <line x1={Math.max(startX, tailX - p.len * 0.5)} y1={p.y} x2={tailX} y2={p.y}
                stroke="#ef4444" strokeWidth={0.7} opacity={op * 0.2} />
              <line x1={tailX} y1={p.y} x2={headX} y2={p.y}
                stroke="#ef4444" strokeWidth={1.8} opacity={op}
                style={{ filter: "drop-shadow(0 0 4px #ef4444)" }} />
            </g>
          );
        })}
        {/* YOUR DATA label on packets */}
        {frame > 62 && (
          <text x={980} y={255} fontSize={11} fill="rgba(239,68,68,0.65)"
            fontFamily="system-ui" fontWeight={700} letterSpacing={2} textAnchor="middle"
            opacity={interpolate(frame, [62, 78], [0, 1], clamp)}>
            YOUR DATA
          </text>
        )}
      </svg>

      {/* ── TARGETED ADS (right column) ── */}
      <div style={{
        position: "absolute",
        right: 80,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: 380,
      }}>
        {ADS.map((ad, i) => (
          <div key={i} style={{
            opacity: adOpacity(i),
            transform: `translateX(${adX(i)}px)`,
            background: "rgba(251,191,36,0.07)",
            border: "1px solid rgba(251,191,36,0.30)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              background: "#fbbf24",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 10,
              fontWeight: 800,
              color: "#000",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}>
              AD
            </div>
            <div style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.80)",
              fontWeight: 500,
              lineHeight: 1.35,
            }}>
              {ad.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── TAGLINE ── */}
      <div style={{
        position: "absolute",
        bottom: 72,
        left: 0, right: 0,
        textAlign: "center",
        opacity: tagOp,
        fontSize: 22,
        fontStyle: "italic",
        color: "rgba(255,255,255,0.60)",
        letterSpacing: "0.01em",
      }}>
        "Because you asked. Now they know."
      </div>
    </AbsoluteFill>
  );
};

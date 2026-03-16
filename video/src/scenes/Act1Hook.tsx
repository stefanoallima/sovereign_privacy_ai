/**
 * Act 1 — The Hook (0–8s, 240 frames)
 *
 * Pure black. White typewriter text. Three intimate questions
 * fade in and out. Ends with the framing line.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const QUESTIONS = [
  "I think I might be sick...",
  "My bank balance is €240.",
  "Am I being underpaid at €65k?",
  "I haven't told my doctor this yet, but...",
];

// Each question occupies a 50-frame window, with 8-frame fades
const Q_DURATION = 52;
const Q_FADE     = 9;

function questionOpacity(frame: number, index: number): number {
  const start = index * Q_DURATION;
  const end   = start + Q_DURATION;
  return interpolate(
    frame,
    [start, start + Q_FADE, end - Q_FADE, end],
    [0, 1, 1, 0],
    clamp,
  );
}

function typewriterChars(frame: number, index: number, text: string): string {
  const start     = index * Q_DURATION + Q_FADE;
  const typeFrames = Q_DURATION - Q_FADE * 2;
  const chars     = Math.floor(
    interpolate(frame, [start, start + typeFrames * 0.7], [0, text.length], clamp),
  );
  return text.slice(0, chars);
}

export const Act1Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // Framing line fades in after all questions
  const framingOp = interpolate(frame, [215, 235], [0, 1], clamp);

  // Subtle keystroke flash — a 1-frame white flash every time a new char appears
  const flashOp = 0; // kept as placeholder; no audio in Remotion by default

  return (
    <AbsoluteFill style={{
      background: "#000000",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 0,
    }}>
      {/* Film grain */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025 }}>
        <filter id="g1"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={1920} height={1080} filter="url(#g1)" />
      </svg>

      {/* Questions */}
      <div style={{
        position: "relative",
        width: 900,
        height: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {QUESTIONS.map((q, i) => {
          const op = questionOpacity(frame, i);
          if (op < 0.01) return null;
          const visible = typewriterChars(frame, i, q);
          const showCursor = visible.length < q.length;
          return (
            <div key={i} style={{
              position: "absolute",
              opacity: op,
              fontSize: 36,
              fontWeight: 300,
              color: "rgba(255,255,255,0.88)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              textAlign: "center",
            }}>
              {visible}
              {showCursor && (
                <span style={{ opacity: 0.6, fontWeight: 100 }}>|</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Framing line */}
      <div style={{
        position: "absolute",
        bottom: 160,
        left: 0, right: 0,
        textAlign: "center",
        opacity: framingOp,
        fontSize: 18,
        fontWeight: 400,
        color: "rgba(255,255,255,0.38)",
        letterSpacing: "0.04em",
      }}>
        You tell AI things you'd never say out loud.
      </div>
    </AbsoluteFill>
  );
};

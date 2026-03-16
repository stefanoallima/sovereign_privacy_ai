/**
 * AppDemo — 8-second showcase of the actual app UI
 *
 * 0–3s   : App in CLOUD mode — user message + Cloud Standard badge + response
 * 3–5s   : Transition: badge flips from Cloud → Anonymized, header changes
 * 5–8s   : App in SOVEREIGN mode — same message, Anonymized badge, green header badge
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { AppMockup } from "../components/AppMockup";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const SceneCloud: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mockup slides in from bottom-right
  const enter = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 90 } });
  const translateY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  // Label fade
  const labelOp = interpolate(frame, [10, 20], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#0a0a12",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}>
      {/* Radial background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 900px 600px at 50% 50%, rgba(239,68,68,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* "Without Sovereign AI" label */}
      <div style={{
        opacity: labelOp,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(239,68,68,0.7)",
        fontFamily: "system-ui, sans-serif",
      }}>
        Without Sovereign AI
      </div>

      {/* App mockup */}
      <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
        <AppMockup frame={frame} fps={fps} mode="cloud" messageStage={2} scale={0.78} />
      </div>
    </AbsoluteFill>
  );
};

const SceneSovereign: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { mass: 0.6, damping: 14, stiffness: 90 } });
  const translateY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  const labelOp = interpolate(frame, [10, 20], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: "#0a0a12",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}>
      {/* Green/violet glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 900px 600px at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* "With Sovereign AI" label */}
      <div style={{
        opacity: labelOp,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(124,58,237,0.85)",
        fontFamily: "system-ui, sans-serif",
      }}>
        With Sovereign AI
      </div>

      {/* App mockup */}
      <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
        <AppMockup frame={frame} fps={fps} mode="sovereign" messageStage={2} scale={0.78} />
      </div>
    </AbsoluteFill>
  );
};

export const AppDemo: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={0}   durationInFrames={100}><SceneCloud /></Sequence>
    <Sequence from={100} durationInFrames={140}><SceneSovereign /></Sequence>
  </AbsoluteFill>
);

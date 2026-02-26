import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

const FULL_TEXT =
  "My salary is €62,500, BSN: 123-456-789, I have a mortgage on Keizersgracht 42...";

const SENSITIVE_RANGES = [
  [13, 21],  // €62,500
  [27, 38],  // 123-456-789
  [57, 73],  // Keizersgracht 42
] as const;

export const Scene1Threat: React.FC = () => {
  const frame = useCurrentFrame();

  const bannerX = interpolate(frame, [100, 130], [1920, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subOpacity = interpolate(frame, [115, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowBlur = 6 + Math.sin(frame * 0.25) * 4;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Fake browser chrome */}
      <div
        style={{
          background: "#1a1a2e",
          border: "1px solid #2d2d4e",
          borderRadius: 16,
          width: 900,
          padding: "20px 32px 32px",
          position: "relative",
        }}
      >
        {/* Browser dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => (
            <div
              key={i}
              style={{ width: 12, height: 12, borderRadius: "50%", background: c }}
            />
          ))}
          <div
            style={{
              marginLeft: 16,
              background: "#2d2d4e",
              borderRadius: 8,
              flex: 1,
              height: 12,
            }}
          />
        </div>

        <div
          style={{
            color: COLORS.textMuted,
            fontSize: 13,
            marginBottom: 16,
            letterSpacing: "0.04em",
          }}
        >
          Cloud AI — New conversation
        </div>

        <div style={{ fontSize: 24, lineHeight: 1.6, color: COLORS.textPrimary, minHeight: 80 }}>
          <SensitiveHighlightText
            text={FULL_TEXT}
            sensitiveRanges={SENSITIVE_RANGES}
            glowBlur={glowBlur}
            startFrame={10}
          />
        </div>
      </div>

      {/* TRANSMITTED banner */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: `translateX(${bannerX}px) translateY(-50%)`,
          background: "rgba(239, 68, 68, 0.9)",
          padding: "20px 60px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#fff",
          }}
        >
          TRANSMITTED TO SERVER
        </div>
        <div
          style={{
            opacity: subOpacity,
            fontSize: 15,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "0.08em",
          }}
        >
          permanent record · training data · ad targeting
        </div>
      </div>
    </AbsoluteFill>
  );
};

function SensitiveHighlightText({
  text,
  sensitiveRanges,
  glowBlur,
  startFrame,
}: {
  text: string;
  sensitiveRanges: readonly (readonly [number, number])[];
  glowBlur: number;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * 0.6));
  const visible = text.slice(0, charsToShow);

  const segments: { text: string; sensitive: boolean }[] = [];
  let cursor = 0;
  for (const [s, e] of sensitiveRanges) {
    if (cursor < s) segments.push({ text: visible.slice(cursor, Math.min(s, charsToShow)), sensitive: false });
    segments.push({ text: visible.slice(Math.min(s, charsToShow), Math.min(e, charsToShow)), sensitive: true });
    cursor = e;
  }
  if (cursor < charsToShow) segments.push({ text: visible.slice(cursor), sensitive: false });

  return (
    <>
      {segments.map((seg, i) =>
        seg.sensitive ? (
          <span
            key={i}
            style={{
              color: "#fca5a5",
              textShadow: `0 0 ${glowBlur}px #ef4444`,
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      {charsToShow < text.length && <span style={{ opacity: 1 }}>|</span>}
    </>
  );
}

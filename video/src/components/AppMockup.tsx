/**
 * AppMockup — pixel-faithful recreation of the Sovereign AI desktop app UI
 *
 * Uses the exact color tokens from apps/desktop/src/index.css (dark mode)
 * and replicates the real layout: sidebar + chat area + message bubbles
 * with privacy indicators.
 *
 * Props:
 *  frame        — current Remotion frame (for typewriter / badge transitions)
 *  fps          — fps from useVideoConfig
 *  mode         — 'cloud'    : shows Cloud Standard badge (threat scenario)
 *               — 'sovereign': shows Anonymized badge (safe scenario)
 *  revealFrame  — frame at which privacy badge transitions
 *  scale        — CSS scale factor (default 1)
 */

import React from "react";
import { interpolate } from "remotion";

/* ─── Design tokens (dark mode, from index.css) ────────────────────────── */
const T = {
  bg:        "hsl(220,14%,16%)",   // #22252e
  surface1:  "hsl(220,13%,20%)",   // sidebar
  surface2:  "hsl(220,13%,24%)",   // cards / bubbles
  surface3:  "hsl(220,13%,28%)",   // hover
  fg:        "hsl(220,10%,93%)",   // #ebebed
  fgMuted:   "hsl(220,8%,74%)",
  fgSubtle:  "hsl(220,8%,54%)",
  border:    "hsl(220,13%,30%)",   // #414757
  primary:   "hsl(199,89%,58%)",   // cyan  #30b8e8
  violet:    "hsl(267,84%,71%)",   // #9d6ef7
  muted:     "hsl(220,13%,24%)",
  green:     "#22c55e",
  blue:      "#3b82f6",
  red:       "#ef4444",
  amber:     "#f59e0b",
};

/* ─── Sidebar conversations ─────────────────────────────────────────────── */
const CONVS = [
  { id: "1", title: "Insulin costs & insurance", icon: "🏥", active: true },
  { id: "2", title: "Tax deductions 2025",       icon: "📊", active: false },
  { id: "3", title: "Investment portfolio",       icon: "💹", active: false },
];

/* ─── Chat messages ─────────────────────────────────────────────────────── */
const USER_MSG =
  "I've been managing Type 2 diabetes. My insulin costs €340/month. What meal plans can help me control blood sugar and reduce my medication costs?";

const ASSISTANT_MSG =
  "Based on your situation, here are evidence-based strategies:\n\n**Low-glycemic eating pattern** focuses on whole grains, legumes, and non-starchy vegetables. Studies show 15–20% reduction in HbA1c over 3 months.\n\n**Key foods to prioritize:**\n• Lentils, chickpeas, black beans\n• Leafy greens, broccoli, cauliflower\n• Berries (low-sugar fruit)\n\nWith consistent dietary changes, many patients reduce insulin requirements by 30–40%, potentially lowering your monthly costs significantly.";

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function typewriter(text: string, frame: number, fps: number, charsPerSec = 40): string {
  const chars = Math.floor((frame / fps) * charsPerSec);
  return text.slice(0, chars);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const WindowBar: React.FC = () => (
  <div style={{
    height: 40,
    background: "hsl(220,13%,18%)",
    borderBottom: `1px solid ${T.border}`,
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    gap: 8,
    flexShrink: 0,
  }}>
    {/* Traffic lights */}
    {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
      <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: c, opacity: 0.9 }} />
    ))}
    <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: T.fgSubtle, fontWeight: 500 }}>
      Sovereign AI
    </div>
  </div>
);

const SidebarItem: React.FC<{ title: string; icon: string; active: boolean }> = ({ title, icon, active }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 10,
    background: active ? "hsla(199,89%,58%,0.12)" : "transparent",
    cursor: "pointer",
    marginBottom: 2,
  }}>
    <span style={{ fontSize: 15 }}>{icon}</span>
    <span style={{
      fontSize: 12.5,
      fontWeight: active ? 600 : 400,
      color: active ? T.primary : T.fgMuted,
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}>
      {title}
    </span>
    {active && (
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, flexShrink: 0 }} />
    )}
  </div>
);

const Sidebar: React.FC = () => (
  <div style={{
    width: 240,
    background: T.surface1,
    borderRight: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  }}>
    {/* Header */}
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 16px",
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* Logo */}
      <div style={{
        width: 28, height: 28,
        borderRadius: 8,
        background: "hsla(267,84%,71%,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14,
      }}>
        🛡️
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.fg }}>Chats</span>
    </div>

    {/* Search */}
    <div style={{ padding: "10px 12px" }}>
      <div style={{
        background: T.muted,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "6px 10px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ fontSize: 11, color: T.fgSubtle }}>🔍</span>
        <span style={{ fontSize: 11.5, color: T.fgSubtle }}>Search conversations...</span>
      </div>
    </div>

    {/* Section label */}
    <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.fgSubtle }}>
      Quick Chat
    </div>

    {/* Conversations */}
    <div style={{ padding: "0 8px", flex: 1 }}>
      {CONVS.map(c => <SidebarItem key={c.id} {...c} />)}
    </div>

    {/* Footer */}
    <div style={{
      padding: "10px 8px",
      borderTop: `1px solid ${T.border}`,
    }}>
      {["⚙️  Settings", "🧭  App Tour"].map((label, i) => (
        <div key={i} style={{
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 12.5,
          color: T.fgSubtle,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          {label}
        </div>
      ))}
    </div>
  </div>
);

const PrivacyBadge: React.FC<{ mode: "cloud" | "sovereign"; opacity?: number }> = ({ mode, opacity = 1 }) => {
  if (mode === "cloud") {
    return (
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 7,
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.25)",
        color: T.amber,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        opacity,
      }}>
        ☁️ Cloud Standard
      </div>
    );
  }
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 8px",
      borderRadius: 7,
      background: "rgba(59,130,246,0.12)",
      border: "1px solid rgba(59,130,246,0.3)",
      color: T.blue,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      opacity,
    }}>
      🔐 Anonymized · Hidden: name, income, location
    </div>
  );
};

const AssistantBubble: React.FC<{ text: string; personaName: string; personaIcon: string; mode: "cloud" | "sovereign" }> = ({
  text, personaName, personaIcon, mode,
}) => {
  const lines = text.split("\n\n");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${T.surface3}, ${T.surface2})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, border: `1px solid ${T.border}`,
      }}>
        {personaIcon}
      </div>
      {/* Bubble */}
      <div style={{
        maxWidth: "82%",
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: "14px 14px 14px 4px",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px 6px",
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.fg }}>{personaName}</span>
          <span style={{ fontSize: 11 }} title={mode === "cloud" ? "Cloud (Nebius)" : "Hybrid (Anonymized)"}>
            {mode === "cloud" ? "⚡" : "🔐"}
          </span>
        </div>
        {/* Content */}
        <div style={{ padding: "10px 14px", fontSize: 12.5, color: T.fgMuted, lineHeight: 1.6 }}>
          {lines.map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return <div key={i} style={{ fontWeight: 700, color: T.fg, marginBottom: 4 }}>{line.replace(/\*\*/g, "")}</div>;
            }
            if (line.includes("**")) {
              // inline bold
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} style={{ margin: "0 0 6px" }}>
                  {parts.map((p, j) =>
                    p.startsWith("**") ? <strong key={j} style={{ color: T.fg, fontWeight: 600 }}>{p.replace(/\*\*/g, "")}</strong> : <span key={j}>{p}</span>
                  )}
                </p>
              );
            }
            if (line.startsWith("•")) {
              return <div key={i} style={{ paddingLeft: 12, marginBottom: 2 }}>{line}</div>;
            }
            return <p key={i} style={{ margin: "0 0 6px" }}>{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
};

const UserBubble: React.FC<{ text: string; mode: "cloud" | "sovereign"; badgeOpacity?: number }> = ({
  text, mode, badgeOpacity = 1,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
    <div style={{
      maxWidth: "75%",
      padding: "10px 14px",
      background: mode === "cloud" ? "hsla(199,89%,58%,0.12)" : "hsla(267,84%,71%,0.12)",
      border: mode === "cloud" ? "1px solid hsla(199,89%,58%,0.22)" : "1px solid hsla(267,84%,71%,0.22)",
      borderRadius: "14px 14px 4px 14px",
      fontSize: 13,
      color: T.fg,
      lineHeight: 1.55,
    }}>
      {text}
    </div>
    <PrivacyBadge mode={mode} opacity={badgeOpacity} />
  </div>
);

const InputBar: React.FC = () => (
  <div style={{
    padding: "12px 16px",
    borderTop: `1px solid ${T.border}`,
    background: T.surface1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  }}>
    <div style={{
      flex: 1,
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 13,
      color: T.fgSubtle,
    }}>
      Message @health-coach…
    </div>
    <div style={{
      width: 34, height: 34,
      borderRadius: 10,
      background: T.primary,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, cursor: "pointer",
    }}>
      ➤
    </div>
  </div>
);

const ChatHeader: React.FC<{ personaIcon: string; personaName: string; mode: "cloud" | "sovereign" }> = ({
  personaIcon, personaName, mode,
}) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 20px",
    borderBottom: `1px solid ${T.border}`,
    background: T.surface1,
    flexShrink: 0,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 9,
      background: `linear-gradient(135deg, ${T.surface3}, ${T.surface2})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 16, border: `1px solid ${T.border}`,
    }}>
      {personaIcon}
    </div>
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.fg }}>@{personaName}</div>
      <div style={{ fontSize: 11, color: T.fgSubtle }}>
        {mode === "cloud" ? "⚡ Cloud — direct API" : "🔐 Hybrid — anonymized"}
      </div>
    </div>
    <div style={{ flex: 1 }} />
    {mode === "sovereign" && (
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 8,
        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
        fontSize: 10.5, fontWeight: 700, color: T.green, letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>
        🛡️ PII Never Leaves Device
      </div>
    )}
  </div>
);

/* ─── Main export ─────────────────────────────────────────────────────────── */

interface AppMockupProps {
  frame: number;
  fps: number;
  /**
   * 'cloud'    — no privacy shield, Cloud Standard badge, normal user bubble
   * 'sovereign'— Anonymized badge, green header badge, hybrid mode
   */
  mode: "cloud" | "sovereign";
  /**
   * 0 = no messages shown yet
   * 1 = user message appeared
   * 2 = both user and assistant visible
   */
  messageStage?: 0 | 1 | 2;
  /** Local frame offset for typewriter effect on assistant message */
  assistantTypeFrame?: number;
  /** Scale of the whole mockup (CSS transform) */
  scale?: number;
  /** Additional wrapper style */
  style?: React.CSSProperties;
}

export const AppMockup: React.FC<AppMockupProps> = ({
  frame,
  fps,
  mode,
  messageStage = 2,
  assistantTypeFrame = 0,
  scale = 1,
  style,
}) => {
  const userMsgOpacity = clamp(interpolate(frame, [0, 8], [0, 1]));
  const assistantMsgOpacity = messageStage >= 2 ? clamp(interpolate(frame, [6, 14], [0, 1])) : 0;
  const badgeOpacity = clamp(interpolate(frame, [4, 12], [0, 1]));

  const assistantText =
    assistantTypeFrame > 0
      ? typewriter(ASSISTANT_MSG, assistantTypeFrame, fps, 60)
      : ASSISTANT_MSG;

  return (
    <div style={{
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      ...style,
    }}>
      {/* Window chrome */}
      <div style={{
        width: 1100,
        height: 680,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        letterSpacing: "-0.011em",
      }}>
        <WindowBar />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar />

          {/* Chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg, overflow: "hidden" }}>
            <ChatHeader personaIcon="🏥" personaName="health-coach" mode={mode} />

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 12px", display: "flex", flexDirection: "column", gap: 18 }}>
              {messageStage >= 1 && (
                <div style={{ opacity: userMsgOpacity }}>
                  <UserBubble text={USER_MSG} mode={mode} badgeOpacity={badgeOpacity} />
                </div>
              )}
              {messageStage >= 2 && (
                <div style={{ opacity: assistantMsgOpacity }}>
                  <AssistantBubble
                    text={assistantText}
                    personaName="Health Coach"
                    personaIcon="🏥"
                    mode={mode}
                  />
                </div>
              )}
            </div>

            <InputBar />
          </div>
        </div>
      </div>
    </div>
  );
};

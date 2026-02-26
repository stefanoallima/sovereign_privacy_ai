import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  angle: number;
  opacity: number;
}

interface Props {
  count?: number;
  color?: string;
}

export const ParticleField: React.FC<Props> = ({
  count = 60,
  color = COLORS.accent,
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (i * 137.5) % 1920,
      y: (i * 93.7) % 1080,
      size: 1 + (i % 3),
      speed: 0.2 + (i % 5) * 0.08,
      angle: (i * 47) % 360,
      opacity: 0.15 + (i % 4) * 0.06,
    }));
  }, [count]);

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.speed * frame;
        const dy = Math.sin(rad) * p.speed * frame;
        const cx = ((p.x + dx) % 1920 + 1920) % 1920;
        const cy = ((p.y + dy) % 1080 + 1080) % 1080;
        return (
          <circle
            key={p.id}
            cx={cx}
            cy={cy}
            r={p.size}
            fill={color}
            opacity={p.opacity}
          />
        );
      })}
    </svg>
  );
};

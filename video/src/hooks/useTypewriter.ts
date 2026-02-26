import { useCurrentFrame } from "remotion";

export function useTypewriter(
  text: string,
  startFrame: number,
  charsPerFrame = 0.6
): string {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  return text.slice(0, charsToShow);
}

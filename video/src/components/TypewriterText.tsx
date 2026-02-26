import React from "react";
import { useTypewriter } from "../hooks/useTypewriter";

interface Props {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  cursorVisible?: boolean;
}

export const TypewriterText: React.FC<Props> = ({
  text,
  startFrame,
  charsPerFrame = 0.6,
  style,
  cursorVisible = true,
}) => {
  const displayed = useTypewriter(text, startFrame, charsPerFrame);
  const isComplete = displayed.length === text.length;

  return (
    <span style={style}>
      {displayed}
      {cursorVisible && !isComplete && (
        <span style={{ opacity: 1, marginLeft: 2 }}>|</span>
      )}
    </span>
  );
};

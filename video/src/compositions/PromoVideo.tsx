import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Act1Hook }       from "../scenes/Act1Hook";
import { Act2Problem }    from "../scenes/Act2Problem";
import { Act3Turn }       from "../scenes/Act3Turn";
import { Act4Proof }      from "../scenes/Act4Proof";
import { Act5Comparison } from "../scenes/Act5Comparison";
import { Act6CTA }        from "../scenes/Act6CTA";
import { TIMING }         from "../constants/timing";

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={TIMING.act1.start} durationInFrames={TIMING.act1.end - TIMING.act1.start}>
        <Act1Hook />
      </Sequence>
      <Sequence from={TIMING.act2.start} durationInFrames={TIMING.act2.end - TIMING.act2.start}>
        <Act2Problem />
      </Sequence>
      <Sequence from={TIMING.act3.start} durationInFrames={TIMING.act3.end - TIMING.act3.start}>
        <Act3Turn />
      </Sequence>
      <Sequence from={TIMING.act4.start} durationInFrames={TIMING.act4.end - TIMING.act4.start}>
        <Act4Proof />
      </Sequence>
      <Sequence from={TIMING.act5.start} durationInFrames={TIMING.act5.end - TIMING.act5.start}>
        <Act5Comparison />
      </Sequence>
      <Sequence from={TIMING.act6.start} durationInFrames={TIMING.act6.end - TIMING.act6.start}>
        <Act6CTA />
      </Sequence>
    </AbsoluteFill>
  );
};

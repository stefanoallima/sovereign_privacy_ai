import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Threat }    from "../scenes/Scene1Threat";
import { Scene2Turn }      from "../scenes/Scene2Turn";
import { Scene3Council }   from "../scenes/Scene3Council";
import { Scene4Pipeline }  from "../scenes/Scene4Pipeline";
import { Scene5DataSplit } from "../scenes/Scene5DataSplit";
import { Scene6LocalMode } from "../scenes/Scene6LocalMode";
import { Scene7TechStack } from "../scenes/Scene7TechStack";
import { Scene8CTA }       from "../scenes/Scene8CTA";
import { TIMING }          from "../constants/timing";

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={TIMING.scene1.start} durationInFrames={TIMING.scene1.end - TIMING.scene1.start}>
        <Scene1Threat />
      </Sequence>
      <Sequence from={TIMING.scene2.start} durationInFrames={TIMING.scene2.end - TIMING.scene2.start}>
        <Scene2Turn />
      </Sequence>
      <Sequence from={TIMING.scene3.start} durationInFrames={TIMING.scene3.end - TIMING.scene3.start}>
        <Scene3Council />
      </Sequence>
      <Sequence from={TIMING.scene4.start} durationInFrames={TIMING.scene4.end - TIMING.scene4.start}>
        <Scene4Pipeline />
      </Sequence>
      <Sequence from={TIMING.scene5.start} durationInFrames={TIMING.scene5.end - TIMING.scene5.start}>
        <Scene5DataSplit />
      </Sequence>
      <Sequence from={TIMING.scene6.start} durationInFrames={TIMING.scene6.end - TIMING.scene6.start}>
        <Scene6LocalMode />
      </Sequence>
      <Sequence from={TIMING.scene7.start} durationInFrames={TIMING.scene7.end - TIMING.scene7.start}>
        <Scene7TechStack />
      </Sequence>
      <Sequence from={TIMING.scene8.start} durationInFrames={TIMING.scene8.end - TIMING.scene8.start}>
        <Scene8CTA />
      </Sequence>
    </AbsoluteFill>
  );
};

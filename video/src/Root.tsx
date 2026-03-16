import React from "react";
import { Composition, registerRoot } from "remotion";
import { PromoVideo } from "./compositions/PromoVideo";
import { StylePreview } from "./compositions/StylePreview";
import { AppDemo } from "./compositions/AppDemo";

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StylePreview"
        component={StylePreview}
        durationInFrames={540}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="AppDemo"
        component={AppDemo}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);

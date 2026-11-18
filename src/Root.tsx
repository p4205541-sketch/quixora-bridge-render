import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

export const Root: React.FC = () => (
  <>
    <Composition
      id="BridgeShort"
      component={BridgeShort}
      durationInFrames={BRIDGE_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="BridgeTest"
      component={BridgeShort}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);

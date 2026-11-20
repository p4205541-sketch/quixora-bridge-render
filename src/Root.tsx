import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { FlyingThunderShort, THUNDER_FRAMES } from "./videos/thunder/Thunder";
import { PachinkoLoopShort, PACHINKO_FRAMES } from "./videos/pachinko_loop/PachinkoLoopShort";
import { ManholeShort, DURATION } from "./videos/manhole/Manhole";

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
    <Composition
      id="FlyingThunderShort"
      component={FlyingThunderShort}
      durationInFrames={THUNDER_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="PachinkoLoopShort"
      component={PachinkoLoopShort}
      durationInFrames={PACHINKO_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="ManholeShort"
      component={ManholeShort}
      durationInFrames={DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);

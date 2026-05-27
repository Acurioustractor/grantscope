import { Composition } from 'remotion';
import { Drain } from './Drain';
import { Tanks } from './Tanks';
import { GoodsImpact } from './GoodsImpact';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="GoodsImpact"
        component={GoodsImpact}
        durationInFrames={1800}    // 60s @ 30fps
        fps={30}
        width={1080}
        height={1920}              // vertical / Reels-shaped
      />
      <Composition
        id="Drain"
        component={Drain}
        durationInFrames={360}     // 12s @ 30fps
        fps={30}
        width={1080}
        height={1920}              // vertical / Reels-shaped
      />
      <Composition
        id="Tanks"
        component={Tanks}
        durationInFrames={450}     // 15s @ 30fps
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

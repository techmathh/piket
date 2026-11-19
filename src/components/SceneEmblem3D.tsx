import React from 'react';

interface SceneEmblem3DProps {
  size?: 'sm' | 'md';
}

/**
 * Compact, hardware-accelerated CSS 3D rotating isometric cube emblem.
 * Provides live spatial depth in the header without cluttering readability.
 */
export const SceneEmblem3D: React.FC<SceneEmblem3DProps> = ({
  size = 'md',
}) => {
  const cubePx = size === 'sm' ? '22px' : '26px';
  const boxCls = size === 'sm' ? 'w-10 h-10' : 'w-11 h-11 sm:w-12 sm:h-12';

  return (
    <div
      data-testid="scene-emblem-3d"
      aria-hidden="true"
      className={`${boxCls} relative rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/90 shadow-[0_3px_0_0_#CBD5E1,inset_0_1px_0_rgba(255,255,255,0.95)] flex flex-col items-center justify-center shrink-0 select-none overflow-hidden`}
    >
      <div
        className="cube3d-stage"
        style={{ ['--cube-size' as string]: cubePx }}
      >
        <div className="cube3d-body">
          <div className="cube3d-face cube3d-front" />
          <div className="cube3d-face cube3d-back" />
          <div className="cube3d-face cube3d-right" />
          <div className="cube3d-face cube3d-left" />
          <div className="cube3d-face cube3d-top" />
          <div className="cube3d-face cube3d-bottom" />
        </div>
      </div>
      <span className="cube3d-floor-shadow w-5 h-1 rounded-full bg-slate-900/30 blur-[1.5px] mt-1.5" />
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface TiltCard3DProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
  testId?: string;
}

/**
 * Interactive 3D perspective card with staggered 3D flip-in entrance,
 * restrained cursor-tracking 3D tilt (mouse only), and subtle specular sheen.
 */
export const TiltCard3D: React.FC<TiltCard3DProps> = ({
  children,
  className = '',
  index = 0,
  testId,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [tilt, setTilt] = useState<{
    rotateX: number;
    rotateY: number;
    glareX: number;
    glareY: number;
    hovered: boolean;
  }>({
    rotateX: 0,
    rotateY: 0,
    glareX: 50,
    glareY: 0,
    hovered: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    // Restrained ±3.2 deg tilt for crisp 3D depth without making text hard to click
    const rotateY = (px - 0.5) * 6.4;
    const rotateX = (0.5 - py) * 5.6;

    setTilt({
      rotateX,
      rotateY,
      glareX: Math.round(px * 100),
      glareY: Math.round(py * 100),
      hovered: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({
      rotateX: 0,
      rotateY: 0,
      glareX: 50,
      glareY: 0,
      hovered: false,
    });
  };

  return (
    <div className="perspective-stage">
      <motion.article
        ref={cardRef}
        data-testid={testId}
        initial={{ opacity: 0, y: 18, rotateX: 7, scale: 0.985 }}
        animate={{
          opacity: 1,
          y: tilt.hovered ? -3 : 0,
          rotateX: tilt.rotateX,
          rotateY: tilt.rotateY,
          scale: 1,
        }}
        transition={{
          opacity: { duration: 0.28, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 0.28, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
          rotateX: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
          rotateY: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ transformStyle: 'preserve-3d' }}
        className={`card-3d relative overflow-hidden ${className}`}
      >
        {/* Subtle cursor-tracked specular 3D highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
          style={{
            opacity: tilt.hovered ? 1 : 0,
            background: `radial-gradient(380px circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.55), transparent 60%)`,
          }}
        />
        <div className="relative z-0">{children}</div>
      </motion.article>
    </div>
  );
};

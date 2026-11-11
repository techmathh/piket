import React from 'react';

interface CharacterAvatar3DProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const CHARACTER_PALETTES = [
  {
    bgTop: '#FFD6A5',
    bgBottom: '#FFAD60',
    border: '#F29339',
    faceTop: '#FFF3E2',
    faceBottom: '#FFE0BA',
    cheek: '#FF8585',
    accessory: '#4EA8DE',
  },
  {
    bgTop: '#BDE0FE',
    bgBottom: '#8ECAE6',
    border: '#5FA8D3',
    faceTop: '#FFF5EB',
    faceBottom: '#FFE3C8',
    cheek: '#FF8FA3',
    accessory: '#FFB703',
  },
  {
    bgTop: '#CAFFBF',
    bgBottom: '#9BF6FF',
    border: '#57CC99',
    faceTop: '#FFF6EC',
    faceBottom: '#FFE4CA',
    cheek: '#FF85A1',
    accessory: '#FF9F1C',
  },
  {
    bgTop: '#FFC6FF',
    bgBottom: '#E0AAFF',
    border: '#C77DFF',
    faceTop: '#FFF5EB',
    faceBottom: '#FFE2C6',
    cheek: '#FF758F',
    accessory: '#48CAE4',
  },
  {
    bgTop: '#FDFFB6',
    bgBottom: '#FFD166',
    border: '#F4A261',
    faceTop: '#FFF6ED',
    faceBottom: '#FFE3C8',
    cheek: '#FF8585',
    accessory: '#06D6A0',
  },
];

function hashName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export const CharacterAvatar3D: React.FC<CharacterAvatar3DProps> = ({
  name,
  size = 'md',
}) => {
  const hash = hashName(name || 'OSIS');
  const palette = CHARACTER_PALETTES[hash % CHARACTER_PALETTES.length];
  const gradId = `char3d-${hash}-${size}`;
  const faceGradId = `face3d-${hash}-${size}`;

  const dims =
    size === 'sm'
      ? 'w-9 h-9'
      : size === 'lg'
      ? 'w-14 h-14'
      : 'w-11 h-11';

  return (
    <div
      className={`${dims} relative shrink-0 rounded-2xl flex items-center justify-center select-none`}
      style={{
        background: `linear-gradient(180deg, ${palette.bgTop} 0%, ${palette.bgBottom} 100%)`,
        border: `2px solid ${palette.border}`,
        boxShadow: `0 3px 0 0 ${palette.border}`,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full p-1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={ gradId } cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="100%" stopColor={palette.bgBottom} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={faceGradId} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={palette.faceTop} />
            <stop offset="100%" stopColor={palette.faceBottom} />
          </radialGradient>
        </defs>

        {/* 3D Glossy Top Highlight */}
        <circle cx="32" cy="32" r="28" fill={`url(#${gradId})`} />

        {/* Cute 3D Ears */}
        <circle cx="13" cy="34" r="5.5" fill={`url(#${faceGradId})`} />
        <circle cx="51" cy="34" r="5.5" fill={`url(#${faceGradId})`} />

        {/* Cute 3D Head Sphere */}
        <rect
          x="15"
          y="16"
          width="34"
          height="33"
          rx="16.5"
          fill={`url(#${faceGradId})`}
        />

        {/* Cute 3D Hair Cap / Beret */}
        <path
          d="M15 29C15 19.5 22.5 13 32 13C41.5 13 49 19.5 49 29C45 25 39 23.5 32 23.5C25 23.5 19 25 15 29Z"
          fill="#3D312A"
        />
        {/* 3D Hair Shine */}
        <path
          d="M23 18.5C26 16.8 30 16.2 34 16.8"
          stroke="#7A6558"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Cute Glossy Eyes */}
        <circle cx="25.5" cy="33" r="3" fill="#2B211C" />
        <circle cx="24.5" cy="31.8" r="1.1" fill="#FFFFFF" />

        <circle cx="38.5" cy="33" r="3" fill="#2B211C" />
        <circle cx="37.5" cy="31.8" r="1.1" fill="#FFFFFF" />

        {/* Rosy 3D Cheeks */}
        <ellipse
          cx="21"
          cy="37"
          rx="3.2"
          ry="2"
          fill={palette.cheek}
          fillOpacity="0.65"
        />
        <ellipse
          cx="43"
          cy="37"
          rx="3.2"
          ry="2"
          fill={palette.cheek}
          fillOpacity="0.65"
        />

        {/* Cheerful Smile */}
        <path
          d="M28.5 37.5C29.5 39.8 34.5 39.8 35.5 37.5"
          stroke="#2B211C"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Tiny OSIS Star Badge on Top */}
        <circle cx="43" cy="18" r="4" fill={palette.accessory} />
        <circle cx="42" cy="17" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    </div>
  );
};

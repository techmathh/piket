/**
 * Self-contained 3D Clay-Style SVG Data Assets for SiPiket OSIS.
 * Stored as TypeScript string constants so GitHub & Vercel builds succeed
 * without requiring external binary image files.
 */

const MASCOT_HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <radialGradient id="bgGlow" cx="35%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#FFF7ED" />
      <stop offset="55%" stop-color="#FFEDD5" />
      <stop offset="100%" stop-color="#FDE68A" />
    </radialGradient>
    <radialGradient id="face3d" cx="38%" cy="32%" r="65%">
      <stop offset="0%" stop-color="#FFF1E6" />
      <stop offset="65%" stop-color="#FCD5B5" />
      <stop offset="100%" stop-color="#E6A97C" />
    </radialGradient>
    <linearGradient id="hair3d" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#44403C" />
      <stop offset="60%" stop-color="#292524" />
      <stop offset="100%" stop-color="#1C1917" />
    </linearGradient>
    <linearGradient id="blazer3d" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F97316" />
      <stop offset="65%" stop-color="#EA580C" />
      <stop offset="100%" stop-color="#C2410C" />
    </linearGradient>
    <linearGradient id="cap3d" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
  </defs>
  <rect width="240" height="240" rx="48" fill="url(#bgGlow)" />
  <circle cx="42" cy="46" r="14" fill="#FDBA74" opacity="0.45" />
  <circle cx="202" cy="58" r="18" fill="#FDE047" opacity="0.5" />
  <circle cx="195" cy="188" r="12" fill="#6EE7B7" opacity="0.45" />

  <!-- Shoulders / OSIS Blazer -->
  <path d="M46 226 C46 172 80 154 120 154 C160 154 194 172 194 226 Z" fill="url(#blazer3d)" />
  <!-- White Shirt & Red Tie -->
  <polygon points="98,156 120,196 142,156" fill="#FFFFFF" />
  <polygon points="115,164 125,164 128,206 120,214 112,206" fill="#DC2626" />
  <!-- OSIS Gold Badge -->
  <circle cx="156" cy="188" r="11" fill="#FBBF24" stroke="#FEF3C7" stroke-width="2.5" />
  <circle cx="156" cy="188" r="5" fill="#D97706" />

  <!-- Neck -->
  <rect x="106" y="136" width="28" height="26" rx="12" fill="url(#face3d)" />

  <!-- Ears -->
  <circle cx="66" cy="108" r="13" fill="url(#face3d)" />
  <circle cx="174" cy="108" r="13" fill="url(#face3d)" />

  <!-- Head 3D Clay -->
  <rect x="68" y="56" width="104" height="92" rx="46" fill="url(#face3d)" />

  <!-- Hair & OSIS Cap -->
  <path d="M64 94 C64 52 90 38 120 38 C150 38 176 52 176 94 C164 74 144 66 120 66 C96 66 76 74 64 94 Z" fill="url(#hair3d)" />
  <path d="M72 64 C78 36 98 26 120 26 C142 26 162 36 168 64 Z" fill="url(#cap3d)" />
  <rect x="64" y="58" width="112" height="12" rx="6" fill="#1E40AF" />
  <circle cx="120" cy="46" r="7" fill="#FBBF24" />

  <!-- 3D Glossy Eyes -->
  <ellipse cx="98" cy="104" rx="8.5" ry="10" fill="#1C1917" />
  <circle cx="95" cy="100" r="3.2" fill="#FFFFFF" />
  <ellipse cx="142" cy="104" rx="8.5" ry="10" fill="#1C1917" />
  <circle cx="139" cy="100" r="3.2" fill="#FFFFFF" />

  <!-- Rosy Cheeks -->
  <ellipse cx="83" cy="116" rx="9" ry="5.5" fill="#FB7185" opacity="0.45" />
  <ellipse cx="157" cy="116" rx="9" ry="5.5" fill="#FB7185" opacity="0.45" />

  <!-- Warm Smile -->
  <path d="M104 120 Q120 134 136 120" fill="none" stroke="#9A3412" stroke-width="5" stroke-linecap="round" />

  <!-- Specular Highlight -->
  <ellipse cx="95" cy="76" rx="18" ry="7" transform="rotate(-18 95 76)" fill="#FFFFFF" opacity="0.35" />
</svg>`;

const BANNER_3D_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220" width="360" height="220">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFEDD5" />
      <stop offset="50%" stop-color="#FDE68A" />
      <stop offset="100%" stop-color="#FED7AA" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFFBEB" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F97316" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>
  </defs>
  <rect width="360" height="220" rx="32" fill="url(#skyGrad)" />
  <circle cx="52" cy="44" r="26" fill="#FB923C" opacity="0.22" />
  <circle cx="312" cy="176" r="36" fill="#F59E0B" opacity="0.22" />
  <circle cx="296" cy="48" r="18" fill="#10B981" opacity="0.22" />

  <!-- 3D Schedule Clipboard Card -->
  <rect x="64" y="34" width="232" height="154" rx="24" fill="#D97706" opacity="0.25" />
  <rect x="64" y="28" width="232" height="154" rx="24" fill="url(#cardGrad)" stroke="#F59E0B" stroke-width="3" />

  <!-- Top Clip -->
  <rect x="140" y="16" width="80" height="24" rx="12" fill="url(#badgeGrad)" />
  <circle cx="180" cy="28" r="5" fill="#FFFBEB" />

  <!-- Schedule Rows inside 3D Card -->
  <rect x="86" y="58" width="32" height="32" rx="10" fill="#10B981" />
  <path d="M95 74 L101 80 L111 68" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
  <rect x="130" y="62" width="110" height="10" rx="5" fill="#292524" />
  <rect x="130" y="78" width="74" height="8" rx="4" fill="#F59E0B" />

  <rect x="86" y="102" width="32" height="32" rx="10" fill="#3B82F6" />
  <circle cx="102" cy="118" r="8" fill="#FFFFFF" />
  <rect x="130" y="106" width="126" height="10" rx="5" fill="#292524" />
  <rect x="130" y="122" width="88" height="8" rx="4" fill="#60A5FA" />

  <!-- Bottom Pill -->
  <rect x="86" y="146" width="188" height="20" rx="10" fill="#FEF3C7" />
  <circle cx="102" cy="156" r="5" fill="#F97316" />
  <rect x="114" y="152" width="118" height="8" rx="4" fill="#D97706" />
</svg>`;

export const mascotHeroImg = `data:image/svg+xml;utf8,${encodeURIComponent(
  MASCOT_HERO_SVG
)}`;

export const banner3dImg = `data:image/svg+xml;utf8,${encodeURIComponent(
  BANNER_3D_SVG
)}`;

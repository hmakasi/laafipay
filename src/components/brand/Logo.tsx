/**
 * Logo LaafiPay — monogramme "LP" fusionné + wordmark + slogan, en SVG inline.
 *
 * Icône : "L" (bleu marine) fusionné au "P" (vert) ; le fût du P contient 3 barres
 * (dégradé bleu → vert) évoquant la data/croissance, et une courbe verte de
 * croissance traverse le bas du monogramme.
 * Wordmark : "laafi" (bleu marine) + "pay" (vert), en Poppins.
 * Slogan : "la solution saas pour votre entreprise", "solution saas" en vert,
 * encadré de deux courtes lignes vertes.
 *
 * Usage :
 * ```tsx
 * import { Logo } from '@/components/brand/Logo';
 *
 * <Logo />                                   // logo complet vertical, taille moyenne, couleurs de marque
 * <Logo variant="icon" size="small" />        // monogramme seul, petit
 * <Logo variant="horizontal" size={280} />    // icône + wordmark + slogan, alignés horizontalement
 * <Logo colorScheme="dark" />                 // version blanche, pour fond sombre
 * <Logo colorScheme="black" variant="icon" /> // monogramme noir, pour usage monochrome
 * ```
 *
 * Des exports SVG statiques (pour Figma/Illustrator) sont disponibles dans
 * `src/assets/brand/` : logo.svg, logo-vertical.svg, logo-horizontal.svg,
 * logo-dark.svg, logo-black.svg, logo-mono.svg, favicon.svg.
 */
import { CSSProperties } from 'react';

export type LogoVariant = 'full' | 'icon' | 'vertical' | 'horizontal';
export type LogoSizeKeyword = 'small' | 'medium' | 'large' | 'xl';
export type LogoSize = LogoSizeKeyword | number;
export type LogoColorScheme = 'brand' | 'dark' | 'black' | 'white' | 'mono';

export interface LogoProps {
  /** 'full'/'vertical' (icône + texte empilés), 'horizontal' (icône + texte côte à côte), 'icon' (monogramme seul). @default 'full' */
  variant?: LogoVariant;
  /** Mot-clé (hauteur en px : small=32, medium=56, large=88, xl=128) ou nombre (largeur en px). @default 'medium' */
  size?: LogoSize;
  /** 'brand' (couleurs d'origine), 'dark'/'white' (tout blanc, fond sombre), 'black' (tout noir), 'mono' (bleu marine uni). @default 'brand' */
  colorScheme?: LogoColorScheme;
  className?: string;
  /** Texte d'accessibilité (aria-label). @default 'Logo LaafiPay' */
  altText?: string;
}

/** Couleurs de marque — valeurs de référence du brief. */
export const BRAND_COLORS = {
  navy: '#083B66',
  navySecondary: '#0F5F88',
  green: '#63C132',
  greenSecondary: '#38B66C',
  background: '#FFFFFF',
} as const;

interface ResolvedColors {
  l: string;
  p: string;
  barFrom: string;
  barTo: string;
  curve: string;
  laafi: string;
  pay: string;
  taglineBase: string;
  taglineAccent: string;
  line: string;
}

const COLOR_SCHEMES: Record<LogoColorScheme, ResolvedColors> = {
  brand: {
    l: BRAND_COLORS.navy,
    p: BRAND_COLORS.green,
    barFrom: BRAND_COLORS.navySecondary,
    barTo: BRAND_COLORS.greenSecondary,
    curve: BRAND_COLORS.green,
    laafi: BRAND_COLORS.navy,
    pay: BRAND_COLORS.green,
    taglineBase: BRAND_COLORS.navy,
    taglineAccent: BRAND_COLORS.green,
    line: BRAND_COLORS.green,
  },
  dark: uniform('#FFFFFF'),
  white: uniform('#FFFFFF'),
  black: uniform('#000000'),
  mono: uniform(BRAND_COLORS.navy),
};

function uniform(color: string): ResolvedColors {
  return {
    l: color,
    p: color,
    barFrom: color,
    barTo: color,
    curve: color,
    laafi: color,
    pay: color,
    taglineBase: color,
    taglineAccent: color,
    line: color,
  };
}

const SIZE_KEYWORD_HEIGHT: Record<LogoSizeKeyword, number> = {
  small: 32,
  medium: 56,
  large: 88,
  xl: 128,
};

/** viewBox (largeur x hauteur) de chaque variant, pour dériver les proportions du conteneur. */
const VIEWBOX = {
  icon: { w: 200, h: 200 },
  vertical: { w: 260, h: 340 },
  horizontal: { w: 460, h: 200 },
} as const;

function resolveDimensions(key: keyof typeof VIEWBOX, size: LogoSize): { width: number; height: number } {
  const { w, h } = VIEWBOX[key];
  const aspect = w / h;

  if (typeof size === 'number') {
    const width = size;
    return { width, height: width / aspect };
  }

  const height = SIZE_KEYWORD_HEIGHT[size];
  return { width: height * aspect, height };
}

let gradientId = 0;

/** Monogramme "L" (bleu) fusionné au "P" (vert), fût du P orné de 3 barres en dégradé, courbe de croissance. */
function MonogramIcon({ colors, className, style }: { colors: ResolvedColors; className?: string; style?: CSSProperties }) {
  const gid = `laafipay-bar-gradient-${gradientId++}`;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.barFrom} />
          <stop offset="100%" stopColor={colors.barTo} />
        </linearGradient>
      </defs>

      {/* Courbe de croissance, en arrière-plan */}
      <path
        d="M44 168 C 88 188, 128 188, 156 168 C 170 158, 176 144, 176 124"
        stroke={colors.curve}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />

      {/* L : fût + pied */}
      <rect x="34" y="40" width="28" height="120" rx="6" fill={colors.l} />
      <rect x="34" y="132" width="68" height="28" rx="6" fill={colors.l} />

      {/* P : fût fusionné au pied du L */}
      <rect x="96" y="40" width="28" height="120" rx="6" fill={colors.p} />
      {/* Panse du P, avec contre-forme (fillRule evenodd) pour le fût creux */}
      <path
        d="M96 40 L150 40 C158 40 160 48 160 58 L160 94 C160 104 158 112 150 112 L96 112 Z
           M124 58 L142 58 C146 58 148 60 148 64 L148 88 C148 92 146 94 142 94 L124 94 Z"
        fill={colors.p}
        fillRule="evenodd"
      />

      {/* 3 barres croissantes dans le fût du P */}
      <rect x="128" y="82" width="5" height="12" fill={`url(#${gid})`} />
      <rect x="135" y="74" width="5" height="20" fill={`url(#${gid})`} />
      <rect x="142" y="64" width="5" height="30" fill={`url(#${gid})`} />
    </svg>
  );
}

function Wordmark({ laafi, pay, className, style }: { laafi: string; pay: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 320 60" className={className} style={style} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <text x="0" y="44" fontFamily="Poppins, Manrope, 'Avenir Next', sans-serif" fontWeight={500} fontSize="42" letterSpacing="0.4">
        <tspan fill={laafi}>laafi</tspan>
        <tspan fill={pay}>pay</tspan>
      </text>
    </svg>
  );
}

function Tagline({
  base,
  accent,
  lineColor,
  className,
  style,
}: {
  base: string;
  accent: string;
  lineColor: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 400 24" className={className} style={style} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="0" y1="12" x2="20" y2="12" stroke={lineColor} strokeWidth="1.5" />
      <text
        x="200"
        y="16"
        textAnchor="middle"
        fontFamily="Poppins, Manrope, 'Avenir Next', sans-serif"
        fontWeight={400}
        fontSize="12"
        letterSpacing="0.2"
      >
        <tspan fill={base}>la </tspan>
        <tspan fill={accent}>solution saas</tspan>
        <tspan fill={base}> pour votre entreprise</tspan>
      </text>
      <line x1="380" y1="12" x2="400" y2="12" stroke={lineColor} strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({
  variant = 'full',
  size = 'medium',
  colorScheme = 'brand',
  className,
  altText = 'Logo LaafiPay',
}: LogoProps) {
  const colors = COLOR_SCHEMES[colorScheme];

  if (variant === 'icon') {
    const { width, height } = resolveDimensions('icon', size);
    return (
      <span role="img" aria-label={altText} className={className} style={{ display: 'inline-block', width, height }}>
        <MonogramIcon colors={colors} style={{ width: '100%', height: '100%' }} />
      </span>
    );
  }

  if (variant === 'horizontal') {
    const { width, height } = resolveDimensions('horizontal', size);
    const iconSize = height;
    const gap = height * 0.22;
    const textWidth = width - iconSize - gap;
    return (
      <span
        role="img"
        aria-label={altText}
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', width, height, gap }}
      >
        <MonogramIcon colors={colors} style={{ width: iconSize, height, flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: textWidth, gap: height * 0.06 }}>
          <Wordmark laafi={colors.laafi} pay={colors.pay} style={{ width: '100%', height: height * 0.42 }} />
          <Tagline base={colors.taglineBase} accent={colors.taglineAccent} lineColor={colors.line} style={{ width: '100%', height: height * 0.16 }} />
        </span>
      </span>
    );
  }

  // 'full' et 'vertical' : icône centrée au-dessus du wordmark, puis du slogan
  const { width, height } = resolveDimensions('vertical', size);
  const iconSize = width * 0.62;
  const gap = height * 0.05;

  return (
    <span
      role="img"
      aria-label={altText}
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width, height, gap }}
    >
      <MonogramIcon colors={colors} style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />
      <Wordmark laafi={colors.laafi} pay={colors.pay} style={{ width: width * 0.85, height: height * 0.16 }} />
      <Tagline base={colors.taglineBase} accent={colors.taglineAccent} lineColor={colors.line} style={{ width, height: height * 0.08 }} />
    </span>
  );
}

export default Logo;

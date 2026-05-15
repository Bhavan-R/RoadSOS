// Design system constants — color palette, typography, spacing, animations
// Aligned with RoadSOS Improved hi-fi design system

export const RS_C = {
  // Primary dark base
  navy: '#060E1C',

  // Semantic colors
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',

  blue050: '#EFF6FF',
  blue100: '#DBEAFE',
  blue300: '#93C5FD',
  blue500: '#3B82F6',
  blue700: '#1D4ED8',

  amber400: '#FCD34D',
  amber500: '#F59E0B',

  green500: '#22C55E',

  // Grayscale
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate900: '#0F172A',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  full: 999,
};

export const ANIMATIONS = {
  pulse: {
    name: 'rs-pulse',
    keyframes: `
      @keyframes rs-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.55); }
        70%  { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
        100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
      }
    `,
    duration: '2.5s',
    easing: 'ease-out',
  },
  blip: {
    name: 'rs-blip',
    keyframes: `
      @keyframes rs-blip {
        0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.9; }
        100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
      }
    `,
    duration: '2.5s',
    easing: 'ease-out',
  },
  blink: {
    name: 'rs-blink',
    keyframes: `
      @keyframes rs-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.5; }
      }
    `,
    duration: '1s',
    easing: 'ease-in-out',
  },
  textblink: {
    name: 'rs-textblink',
    keyframes: `
      @keyframes rs-textblink {
        0%, 100% { opacity: 1; text-shadow: 0 0 0 transparent; }
        50%      { opacity: 0.7; text-shadow: 0 0 24px rgba(220,38,38,0.5); }
      }
    `,
    duration: '1.5s',
    easing: 'ease-in-out',
  },
  sonar: {
    name: 'rs-sonar',
    keyframes: `
      @keyframes rs-sonar {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.9; }
        100% { transform: translate(-50%,-50%) scale(1.25); opacity: 0; }
      }
    `,
    duration: 'var(--rs-sonar-duration, 2s)',
    easing: 'ease-out',
  },
  glassblink: {
    name: 'rs-glassblink',
    keyframes: `
      @keyframes rs-glassblink {
        0%, 100% { box-shadow: 0 10px 32px rgba(29,78,216,0.4), inset 0 1px 0 rgba(255,255,255,0.25); }
        50%      { box-shadow: 0 16px 44px rgba(29,78,216,0.7), inset 0 1px 0 rgba(255,255,255,0.35); }
      }
    `,
    duration: '1s',
    easing: 'ease-in-out',
  },
};

export const TYPOGRAPHY = {
  // Font families (set via CSS variables in root)
  display: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
  body: 'var(--rs-font-body, "Geist", "Inter Tight", system-ui, sans-serif)',
  mono: 'var(--rs-font-mono, "JetBrains Mono", "Geist Mono", ui-monospace, monospace)',
};

export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 12px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 32px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 50px rgba(0, 0, 0, 0.3)',
};

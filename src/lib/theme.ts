/**
 * Baam Theme Configuration
 *
 * Central theme file controlling all colors, fonts, sizes, spacing.
 * Pattern follows medical-clinic/chinese-medicine project:
 * - Define theme as TypeScript object
 * - Inject as CSS variables at runtime via layout
 * - Tailwind maps CSS variables to utility classes
 * - Components consume via Tailwind classes or var() references
 */

export interface BaamTheme {
  colors: {
    primary: {
      50: string;
      100: string;
      200: string;
      light: string;
      DEFAULT: string;
      dark: string;
      700: string;
    };
    secondary: {
      50: string;
      light: string;
      DEFAULT: string;
      dark: string;
    };
    accent: {
      blue: string;
      blueLight: string;
      green: string;
      greenLight: string;
      red: string;
      redLight: string;
      yellow: string;
      purple: string;
      purpleLight: string;
    };
    backdrop: {
      primary: string;
      secondary: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
      inverse: string;
    };
    border: {
      DEFAULT: string;
      light: string;
    };
    bg: {
      page: string;
      card: string;
      sidebar: string;
    };
  };
  typography: {
    display: string;
    heading: string;
    subheading: string;
    body: string;
    small: string;
    xs: string;
    fonts: {
      display: string;
      heading: string;
      body: string;
      mono: string;
    };
  };
  shape: {
    radius: string;
    radiusLg: string;
    radiusXl: string;
    radiusFull: string;
    shadow: string;
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
  };
  layout: {
    navHeight: string;
    sidebarWidth: string;
    containerMax: string;
    contentMax: string;
    spacingDensity: 'compact' | 'comfortable' | 'spacious';
  };
}

// ============================================================
// BAAM DEFAULT THEME — Orange brand, Chinese community portal
// ============================================================
export const baamTheme: BaamTheme = {
  colors: {
    primary: {
      50: '#FFF7ED',
      100: '#FFEDD5',
      200: '#FED7AA',
      light: '#FB923C',     // Orange-400
      DEFAULT: '#F97316',   // Orange-500 — brand primary
      dark: '#EA580C',      // Orange-600
      700: '#C2410C',       // Orange-700
    },
    secondary: {
      50: '#EFF6FF',
      light: '#93C5FD',
      DEFAULT: '#3B82F6',   // Blue-500 — AI features, info
      dark: '#1D4ED8',
    },
    accent: {
      blue: '#3B82F6',
      blueLight: '#DBEAFE',
      green: '#22C55E',
      greenLight: '#DCFCE7',
      red: '#EF4444',
      redLight: '#FEE2E2',
      yellow: '#EAB308',
      purple: '#8B5CF6',
      purpleLight: '#EDE9FE',
    },
    backdrop: {
      primary: '#FFF7ED',   // Very light orange tint
      secondary: '#EFF6FF', // Very light blue tint
    },
    text: {
      primary: '#111827',   // Gray-900
      secondary: '#6B7280', // Gray-500
      muted: '#9CA3AF',     // Gray-400
      inverse: '#FFFFFF',
    },
    border: {
      DEFAULT: '#E5E7EB',   // Gray-200
      light: '#F3F4F6',     // Gray-100
    },
    bg: {
      page: '#F9FAFB',      // Gray-50
      card: '#FFFFFF',
      sidebar: '#1F2937',   // Gray-800 (admin sidebar)
    },
  },
  typography: {
    display: '2.25rem',     // 36px — hero titles
    heading: '1.5rem',      // 24px — section titles
    subheading: '1.125rem', // 18px — card titles
    body: '0.9375rem',      // 15px — body text (slightly larger for Chinese)
    small: '0.8125rem',     // 13px — meta, tags
    xs: '0.75rem',          // 12px — badges, timestamps
    fonts: {
      display: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
      heading: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
      body: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
      mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
    },
  },
  shape: {
    radius: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
    radiusFull: '9999px',
    shadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    shadowSm: '0 1px 2px rgba(0,0,0,0.05)',
    shadowMd: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
    shadowLg: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
  },
  layout: {
    navHeight: '64px',
    sidebarWidth: '240px',
    containerMax: '1280px',
    contentMax: '800px',
    spacingDensity: 'comfortable',
  },
};

// ============================================================
// Generate CSS variables string from theme
// ============================================================
export function generateThemeCSS(theme: BaamTheme): string {
  const spacingMap = { compact: '3rem', comfortable: '5rem', spacious: '8rem' };

  return `
    :root {
      /* Primary Colors */
      --primary: ${theme.colors.primary.DEFAULT};
      --primary-dark: ${theme.colors.primary.dark};
      --primary-light: ${theme.colors.primary.light};
      --primary-50: ${theme.colors.primary[50]};
      --primary-100: ${theme.colors.primary[100]};
      --primary-200: ${theme.colors.primary[200]};
      --primary-700: ${theme.colors.primary[700]};

      /* Secondary Colors */
      --secondary: ${theme.colors.secondary.DEFAULT};
      --secondary-dark: ${theme.colors.secondary.dark};
      --secondary-light: ${theme.colors.secondary.light};
      --secondary-50: ${theme.colors.secondary[50]};

      /* Accent Colors */
      --accent-blue: ${theme.colors.accent.blue};
      --accent-blue-light: ${theme.colors.accent.blueLight};
      --accent-green: ${theme.colors.accent.green};
      --accent-green-light: ${theme.colors.accent.greenLight};
      --accent-red: ${theme.colors.accent.red};
      --accent-red-light: ${theme.colors.accent.redLight};
      --accent-yellow: ${theme.colors.accent.yellow};
      --accent-purple: ${theme.colors.accent.purple};
      --accent-purple-light: ${theme.colors.accent.purpleLight};

      /* Backdrop */
      --backdrop-primary: ${theme.colors.backdrop.primary};
      --backdrop-secondary: ${theme.colors.backdrop.secondary};

      /* Text Colors */
      --text-primary: ${theme.colors.text.primary};
      --text-secondary: ${theme.colors.text.secondary};
      --text-muted: ${theme.colors.text.muted};
      --text-inverse: ${theme.colors.text.inverse};

      /* Borders */
      --border: ${theme.colors.border.DEFAULT};
      --border-light: ${theme.colors.border.light};

      /* Backgrounds */
      --bg-page: ${theme.colors.bg.page};
      --bg-card: ${theme.colors.bg.card};
      --bg-sidebar: ${theme.colors.bg.sidebar};

      /* Typography */
      --text-display: ${theme.typography.display};
      --text-heading: ${theme.typography.heading};
      --text-subheading: ${theme.typography.subheading};
      --text-body: ${theme.typography.body};
      --text-small: ${theme.typography.small};
      --text-xs: ${theme.typography.xs};
      --font-display: ${theme.typography.fonts.display};
      --font-heading: ${theme.typography.fonts.heading};
      --font-body: ${theme.typography.fonts.body};
      --font-mono: ${theme.typography.fonts.mono};

      /* Shape */
      --radius: ${theme.shape.radius};
      --radius-lg: ${theme.shape.radiusLg};
      --radius-xl: ${theme.shape.radiusXl};
      --radius-full: ${theme.shape.radiusFull};
      --shadow: ${theme.shape.shadow};
      --shadow-sm: ${theme.shape.shadowSm};
      --shadow-md: ${theme.shape.shadowMd};
      --shadow-lg: ${theme.shape.shadowLg};

      /* Layout */
      --nav-height: ${theme.layout.navHeight};
      --sidebar-width: ${theme.layout.sidebarWidth};
      --container-max: ${theme.layout.containerMax};
      --content-max: ${theme.layout.contentMax};
      --section-padding-y: ${spacingMap[theme.layout.spacingDensity]};
    }
  `;
}

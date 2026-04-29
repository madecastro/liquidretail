// Reach Social Chakra theme — color tokens, radii, shadows, component
// variants. Verbatim from the design spec at
// reach_social_chakra_theme_layout_spec.md so any later updates can be
// diff'd against the source of truth.
//
// Component-variant philosophy: rainbow-gradient surfaces are reserved
// for primary CTA / progress / completion. Body content stays mostly
// white-on-canvas with brand.ink text. The gradient is used as an
// expressive accent, not a base background.

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false
};

// Bare token map — exposed so non-theme code (canvases, dynamic
// styles, etc.) can reference the same hex values without going
// through Chakra's theme accessor.
export const rsColors = {
  ink:     '#0B1020',
  canvas:  '#F8FAFC',
  surface: '#FFFFFF',
  border:  '#E5E7EB',
  muted:   '#64748B',

  magenta: '#D9008D',
  violet:  '#7A35E8',
  blue:    '#0B84D8',
  cyan:    '#16B8D8',
  lime:    '#A7E51F',
  yellow:  '#FFD400',
  orange:  '#F57C00',

  success: '#059669',
  warning: '#D97706',
  danger:  '#DC2626'
} as const;

// Primary gradient — the "Reach Social" expressive accent. Reserve
// for primary CTA, progress, and completion states. Never use as a
// large background.
export const rsGradient =
  'linear-gradient(135deg,' +
  ' #D9008D 0%,' +
  ' #7A35E8 24%,' +
  ' #16B8D8 48%,' +
  ' #A7E51F 72%,' +
  ' #FFD400 88%,' +
  ' #F57C00 100%)';

export const reachSocialTheme = extendTheme({
  config,
  fonts: {
    heading: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body:    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  colors: {
    brand: {
      ink:     rsColors.ink,
      canvas:  rsColors.canvas,
      surface: rsColors.surface,
      border:  rsColors.border,
      muted:   rsColors.muted,
      magenta: rsColors.magenta,
      violet:  rsColors.violet,
      blue:    rsColors.blue,
      cyan:    rsColors.cyan,
      lime:    rsColors.lime,
      yellow:  rsColors.yellow,
      orange:  rsColors.orange
    },
    rsViolet: {
      50:  '#F5F0FF', 100: '#EDE2FF', 200: '#D8C0FF', 300: '#B98AFF',
      400: '#9558F0', 500: '#7A35E8', 600: '#6427C2', 700: '#4D1D96',
      800: '#38166B', 900: '#251044'
    },
    rsMagenta: {
      50:  '#FDF2FA', 100: '#FCE7F6', 200: '#F9C7EA', 300: '#F472D8',
      400: '#E737BE', 500: '#D9008D', 600: '#B90078', 700: '#93005F',
      800: '#6E0047', 900: '#48002F'
    },
    rsCyan: {
      50:  '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
      400: '#36D6EC', 500: '#16B8D8', 600: '#0A90C4', 700: '#0872A0',
      800: '#0B587A', 900: '#0B3E55'
    },
    rsLime: {
      50:  '#F7FEE7', 100: '#ECFCCB', 200: '#D9F99D', 300: '#BEF264',
      400: '#A7E51F', 500: '#84CC16', 600: '#65A30D', 700: '#4D7C0F',
      800: '#3F6212', 900: '#365314'
    },
    rsYellow: {
      50:  '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047',
      400: '#FFD400', 500: '#F8B900', 600: '#D97706', 700: '#B45309',
      800: '#92400E', 900: '#78350F'
    },
    rsOrange: {
      50:  '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
      400: '#FB923C', 500: '#F57C00', 600: '#EA580C', 700: '#C2410C',
      800: '#9A3412', 900: '#7C2D12'
    }
  },
  radii: {
    md:    '12px',
    lg:    '16px',
    xl:    '20px',
    '2xl': '24px',
    '3xl': '32px',
    full:  '9999px'
  },
  shadows: {
    sm:         '0 2px 8px rgba(15, 23, 42, 0.06)',
    md:         '0 8px 24px rgba(15, 23, 42, 0.08)',
    lg:         '0 20px 45px rgba(15, 23, 42, 0.12)',
    brand:      '0 12px 28px rgba(122, 53, 232, 0.22)',
    focusBrand: '0 0 0 4px rgba(122, 53, 232, 0.16)'
  },
  styles: {
    global: {
      body: {
        bg: rsColors.canvas,
        color: rsColors.ink,
        WebkitFontSmoothing: 'antialiased'
      }
    }
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'xl',
        fontWeight: '700',
        transitionProperty: 'common',
        transitionDuration: '150ms'
      },
      variants: {
        // The Reach Social signature CTA — gradient fill + brand
        // shadow. Reserve for primary actions only.
        brand: {
          color: 'white',
          bgGradient: 'linear(135deg,#D9008D 0%,#7A35E8 30%,#16B8D8 60%,#FFD400 100%)',
          boxShadow: 'brand',
          _hover:  { filter: 'brightness(1.04)', transform: 'translateY(-1px)' },
          _active: { transform: 'translateY(0px) scale(.99)' }
        },
        solid: {
          bg: 'brand.ink',
          color: 'white',
          _hover: { bg: 'black' }
        },
        outline: {
          bg: 'white',
          borderColor: 'gray.200',
          color: 'brand.ink',
          _hover: { bg: 'gray.50' }
        },
        ghost: {
          color: 'gray.600',
          _hover: { bg: 'gray.100', color: 'brand.ink' }
        },
        softBrand: {
          bg: 'rsViolet.50',
          color: 'rsViolet.700',
          _hover: { bg: 'rsViolet.100' }
        }
      },
      defaultProps: {
        size: 'md',
        variant: 'solid'
      }
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: '3xl',
          borderWidth: '1px',
          borderColor: 'gray.200',
          bg: 'whiteAlpha.900',
          boxShadow: 'sm'
        }
      }
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderRadius: 'xl',
            borderColor: 'gray.200',
            bg: 'white',
            _hover: { borderColor: 'gray.300' },
            _focusVisible: {
              borderColor: 'rsViolet.400',
              boxShadow: 'focusBrand'
            }
          }
        }
      }
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        px: 2,
        py: '2px',
        fontWeight: '700',
        textTransform: 'none'
      },
      variants: {
        brand:      { color: 'white', bgGradient: 'linear(135deg,#D9008D,#7A35E8,#16B8D8)' },
        complete:   { bg: 'green.50',     color: 'green.700',    borderColor: 'green.200',    borderWidth: '1px' },
        pending:    { bg: 'gray.100',     color: 'gray.600',     borderColor: 'gray.200',     borderWidth: '1px' },
        processing: { bg: 'rsViolet.50',  color: 'rsViolet.700', borderColor: 'rsViolet.100', borderWidth: '1px' },
        warning:    { bg: 'rsYellow.50',  color: 'rsOrange.700', borderColor: 'rsYellow.200', borderWidth: '1px' }
      }
    }
  }
});

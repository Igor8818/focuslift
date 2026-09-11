/**
 * Paleta Dark Theme — Padrão do FocusLift
 * Alta contrastância, otimizada para ambientes de academia (luz baixa).
 */
export const darkColors = {
  // Fundo e Superfícies
  background: '#0A0D14',
  surface: '#141824',
  surfaceElevated: '#1C2233',
  surfaceBorder: '#262F44',
  surfaceBorderHover: '#3B4866',

  // Tipografia
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Acentos
  primary: '#38BDF8',
  primaryLight: 'rgba(56, 189, 248, 0.15)',
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  streak: '#F59E0B',
  streakLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',

  // Hábitos
  protein: '#A855F7',
  proteinLight: 'rgba(168, 85, 247, 0.15)',
  water: '#06B6D4',
  waterLight: 'rgba(6, 182, 212, 0.15)',
  workout: '#38BDF8',
  workoutLight: 'rgba(56, 189, 248, 0.15)',
  meals: '#F97316',
  mealsLight: 'rgba(249, 115, 22, 0.15)',
} as const;

/**
 * Paleta Light Theme — Modo diurno / ambientes iluminados
 */
export const lightColors = {
  // Fundo e Superfícies
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceBorder: '#E2E8F0',
  surfaceBorderHover: '#CBD5E1',

  // Tipografia
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Acentos (mesmos do dark para consistência de marca)
  primary: '#0284C7',
  primaryLight: 'rgba(2, 132, 199, 0.12)',
  success: '#059669',
  successLight: 'rgba(5, 150, 105, 0.12)',
  streak: '#D97706',
  streakLight: 'rgba(217, 119, 6, 0.12)',
  danger: '#DC2626',
  dangerLight: 'rgba(220, 38, 38, 0.12)',

  // Hábitos
  protein: '#9333EA',
  proteinLight: 'rgba(147, 51, 234, 0.12)',
  water: '#0891B2',
  waterLight: 'rgba(8, 145, 178, 0.12)',
  workout: '#0284C7',
  workoutLight: 'rgba(2, 132, 199, 0.12)',
  meals: '#EA580C',
  mealsLight: 'rgba(234, 88, 12, 0.12)',
} as const;

export type ColorTokens = { [K in keyof typeof darkColors]: string };
export type Theme = 'dark' | 'light';

/**
 * Alias estático para retrocompatibilidade com componentes que
 * ainda importam Colors diretamente. Sempre aponta para o dark theme.
 * Novos componentes devem usar useColors() do ThemeContext.
 */
export const Colors = darkColors;

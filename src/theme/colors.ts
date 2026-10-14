/**
 * Paleta Dark Theme — Padrão do FocusLift
 * Alta contrastância, otimizada para ambientes de academia (luz baixa).
 *
 * Identidade: violeta elétrico (mesma cor do ícone do app) sobre fundo
 * "midnight" levemente arroxeado. Cores funcionais (sucesso, perigo, streak)
 * e de hábitos ficam distintas do violeta para nunca competirem com a marca.
 */
export const darkColors = {
  // Fundo e Superfícies
  background: '#0B0A12',
  surface: '#14121F',
  surfaceElevated: '#1D1A2E',
  surfaceBorder: '#2B2742',
  surfaceBorderHover: '#40396A',

  // Tipografia
  textPrimary: '#FFFFFF',
  textSecondary: '#A9A6C4',
  textMuted: '#706D8E',

  // Marca / Acentos
  primary: '#9A6BFF',
  primaryStrong: '#7C3AED',
  primaryLight: 'rgba(154, 107, 255, 0.16)',
  accent: '#E879F9',
  /** Cor do texto/ícone sobre superfícies `primary` (botões preenchidos). */
  onPrimary: '#0B0A12',
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  streak: '#F59E0B',
  streakLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#F43F5E',
  dangerLight: 'rgba(244, 63, 94, 0.15)',

  // Hábitos
  protein: '#F472B6',
  proteinLight: 'rgba(244, 114, 182, 0.15)',
  water: '#22D3EE',
  waterLight: 'rgba(34, 211, 238, 0.15)',
  workout: '#9A6BFF',
  workoutLight: 'rgba(154, 107, 255, 0.16)',
  meals: '#FB923C',
  mealsLight: 'rgba(251, 146, 60, 0.15)',
} as const;

/**
 * Paleta Light Theme — Modo diurno / ambientes iluminados
 */
export const lightColors = {
  // Fundo e Superfícies
  background: '#F5F3FF',
  surface: '#FFFFFF',
  surfaceElevated: '#FAF8FF',
  surfaceBorder: '#E4DEF7',
  surfaceBorderHover: '#CFC6EE',

  // Tipografia
  textPrimary: '#1A1330',
  textSecondary: '#4C4570',
  textMuted: '#8C86AD',

  // Marca / Acentos (mesma família do dark para consistência de marca)
  primary: '#6D28D9',
  primaryStrong: '#5B21B6',
  primaryLight: 'rgba(109, 40, 217, 0.10)',
  accent: '#C026D3',
  onPrimary: '#FFFFFF',
  success: '#059669',
  successLight: 'rgba(5, 150, 105, 0.12)',
  streak: '#D97706',
  streakLight: 'rgba(217, 119, 6, 0.12)',
  danger: '#E11D48',
  dangerLight: 'rgba(225, 29, 72, 0.12)',

  // Hábitos
  protein: '#DB2777',
  proteinLight: 'rgba(219, 39, 119, 0.12)',
  water: '#0891B2',
  waterLight: 'rgba(8, 145, 178, 0.12)',
  workout: '#6D28D9',
  workoutLight: 'rgba(109, 40, 217, 0.10)',
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

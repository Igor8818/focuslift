/**
 * Tokens de cores para o Dark Theme de Alto Contraste do FocusLift.
 * Otimizado para legibilidade, economia de energia e ambiente de treino.
 */
export const Colors = {
  // Fundo e Superfícies
  background: '#0A0D14',
  surface: '#141824',
  surfaceElevated: '#1C2233',
  surfaceBorder: '#262F44',
  surfaceBorderHover: '#3B4866',

  // Tipografia de Alto Contraste
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Acentos Vibrantes e Status
  primary: '#38BDF8', // Azul Sky vibrante (Ação e Destaque)
  primaryLight: 'rgba(56, 189, 248, 0.15)',
  
  success: '#10B981', // Verde Esmeralda (Concluído)
  successLight: 'rgba(16, 185, 129, 0.15)',

  streak: '#F59E0B', // Âmbar Dourado (Fogo/Streak)
  streakLight: 'rgba(245, 158, 11, 0.15)',

  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',

  // Hábitos Específicos
  protein: '#A855F7', // Roxo (Proteína)
  proteinLight: 'rgba(168, 85, 247, 0.15)',

  water: '#06B6D4', // Ciano (Água)
  waterLight: 'rgba(6, 182, 212, 0.15)',

  workout: '#38BDF8', // Azul (Treino)
  workoutLight: 'rgba(56, 189, 248, 0.15)',

  meals: '#F97316', // Laranja (Refeições)
  mealsLight: 'rgba(249, 115, 22, 0.15)',
} as const;

export type ColorTokens = typeof Colors;

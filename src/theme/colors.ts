/**
 * Paleta de Cores Obsidian Matte — FocusLift Design System
 * 
 * Alta contrastância, calibrada para ambientes de academia (luz baixa/alta).
 * Base inspirada em interfaces modernas (Linear, Hevy, Whoop):
 * Fundo neutro Zinc/Obsidian Matte com violeta elétrico exclusivo para ações e destaques.
 */

export const darkColors = {
  // Fundo e Superfícies (Zinc/Obsidian Matte)
  background: '#09090B',
  surface: '#121215',
  surfaceElevated: '#18181C',
  surfaceBorder: '#27272A',
  surfaceBorderHover: '#3F3F46',

  // Tipografia
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',

  // Marca / Acentos
  primary: '#8B5CF6',
  primaryStrong: '#7C3AED',
  primaryLight: 'rgba(139, 92, 246, 0.14)',
  accent: '#C084FC',
  onPrimary: '#FFFFFF',

  // Cores Semânticas
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  streak: '#F59E0B',
  streakLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#F43F5E',
  dangerLight: 'rgba(244, 63, 94, 0.15)',
  error: '#F43F5E',

  // Hábitos
  protein: '#F472B6',
  proteinLight: 'rgba(244, 114, 182, 0.15)',
  water: '#22D3EE',
  waterLight: 'rgba(34, 211, 238, 0.15)',
  workout: '#8B5CF6',
  workoutLight: 'rgba(139, 92, 246, 0.14)',
  meals: '#FB923C',
  mealsLight: 'rgba(251, 146, 60, 0.15)',
} as const;

export const lightColors = {
  // Fundo e Superfícies
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  surfaceBorder: '#E2E8F0',
  surfaceBorderHover: '#CBD5E1',

  // Tipografia
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Marca / Acentos
  primary: '#6D28D9',
  primaryStrong: '#5B21B6',
  primaryLight: 'rgba(109, 40, 217, 0.10)',
  accent: '#7C3AED',
  onPrimary: '#FFFFFF',

  // Cores Semânticas
  success: '#059669',
  successLight: 'rgba(5, 150, 105, 0.12)',
  streak: '#D97706',
  streakLight: 'rgba(217, 119, 6, 0.12)',
  danger: '#E11D48',
  dangerLight: 'rgba(225, 29, 72, 0.12)',
  error: '#E11D48',

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

export const Colors = darkColors;

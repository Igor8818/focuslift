import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { type WorkoutWithDetails } from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';

export interface WorkoutCardProps {
  workout: WorkoutWithDetails;
  onPress?: (workout: WorkoutWithDetails) => void;
}

/**
 * Calcula o volume total acumulado em quilogramas (peso * reps) de todas as séries do treino.
 */
export function calculateWorkoutTotalVolume(workout: WorkoutWithDetails): number {
  if (!workout.exercises || workout.exercises.length === 0) {
    return 0;
  }

  let total = 0;
  for (const exercise of workout.exercises) {
    if (exercise.sets) {
      for (const s of exercise.sets) {
        total += (s.weight || 0) * (s.reps || 0);
      }
    }
  }
  return Math.round(total);
}

/**
 * Formata um número de volume com separadores amigáveis.
 */
export function formatVolumeKg(volumeKg: number): string {
  if (volumeKg >= 10000) {
    return `${(volumeKg / 1000).toFixed(1).replace('.', ',')} t`;
  }
  return `${volumeKg.toLocaleString('pt-BR')} kg`;
}

/**
 * Formata uma data ISO ou string YYYY-MM-DD para exibição amigável conforme o idioma.
 */
export function formatDisplayDate(dateStr: string, lang = 'pt'): string {
  try {
    const parts = dateStr.split('-');
    const locale =
      lang === 'en'
        ? 'en-US'
        : lang === 'es'
        ? 'es-ES'
        : lang === 'de'
        ? 'de-DE'
        : lang === 'fr'
        ? 'fr-FR'
        : 'pt-BR';
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale);
  } catch {
    return dateStr;
  }
}

// Paleta de cores para grupos musculares — cada grupo tem cor própria
const MUSCLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  peito:      { bg: 'rgba(239,68,68,0.12)',  text: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  costas:     { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA', border: 'rgba(59,130,246,0.3)' },
  perna:      { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  pernas:     { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  quadríceps: { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  quadriceps: { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  ombro:      { bg: 'rgba(168,85,247,0.12)', text: '#A855F7', border: 'rgba(168,85,247,0.3)' },
  ombros:     { bg: 'rgba(168,85,247,0.12)', text: '#A855F7', border: 'rgba(168,85,247,0.3)' },
  bíceps:     { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  biceps:     { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  tríceps:    { bg: 'rgba(249,115,22,0.12)', text: '#F97316', border: 'rgba(249,115,22,0.3)' },
  triceps:    { bg: 'rgba(249,115,22,0.12)', text: '#F97316', border: 'rgba(249,115,22,0.3)' },
  abdômen:    { bg: 'rgba(6,182,212,0.12)',  text: '#06B6D4', border: 'rgba(6,182,212,0.3)' },
  abdomen:    { bg: 'rgba(6,182,212,0.12)',  text: '#06B6D4', border: 'rgba(6,182,212,0.3)' },
  panturrilha:{ bg: 'rgba(52,211,153,0.12)', text: '#34D399', border: 'rgba(52,211,153,0.3)' },
  glúteo:     { bg: 'rgba(244,63,94,0.12)',  text: '#F43F5E', border: 'rgba(244,63,94,0.3)' },
  gluteo:     { bg: 'rgba(244,63,94,0.12)',  text: '#F43F5E', border: 'rgba(244,63,94,0.3)' },
  trapézio:   { bg: 'rgba(99,102,241,0.12)', text: '#818CF8', border: 'rgba(99,102,241,0.3)' },
};

/** Obtém a cor do grupo muscular (com fallback para primary) */
function getMuscleColor(group: string, primaryColor: string): { bg: string; text: string; border: string } {
  const key = group.toLowerCase().trim();
  // Busca exata
  if (MUSCLE_COLORS[key]) return MUSCLE_COLORS[key];
  // Busca parcial (ex: "Perna / Quadríceps" → "perna")
  for (const [k, v] of Object.entries(MUSCLE_COLORS)) {
    if (key.includes(k)) return v;
  }
  // Fallback: cor primária do tema
  return {
    bg: `${primaryColor}18`,
    text: primaryColor,
    border: `${primaryColor}40`,
  };
}

/** Gera um emoji representativo baseado no título do treino */
function getWorkoutIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('peito') || t.includes('chest')) return '🫀';
  if (t.includes('costas') || t.includes('back')) return '🦾';
  if (t.includes('perna') || t.includes('leg')) return '🦵';
  if (t.includes('ombro') || t.includes('shoulder')) return '🏋️';
  if (t.includes('braço') || t.includes('arm') || t.includes('bíceps') || t.includes('tríceps')) return '💪';
  if (t.includes('cardio') || t.includes('corrida')) return '🏃';
  if (t.includes('full') || t.includes('corpo todo')) return '⚡';
  return '🏋️';
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onPress,
}) => {
  const { colors } = useTheme();
  const { t, language, tMuscle, tRoutine, formatWeight } = useTranslation();
  const styles = makeStyles(colors);
  const totalVolume = calculateWorkoutTotalVolume(workout);
  const exerciseCount = workout.exercises ? workout.exercises.length : 0;

  // Extrair grupos musculares únicos
  const muscleGroups = Array.from(
    new Set(
      (workout.exercises || [])
        .map((e) => e.muscle_group)
        .filter((g): g is string => !!g && g.trim().length > 0)
    )
  );

  // Contagem total de séries
  const totalSets = (workout.exercises || []).reduce(
    (acc, ex) => acc + (ex.sets ? ex.sets.length : 0),
    0
  );

  // Cor da barra lateral: baseada no primeiro grupo muscular
  const accentColor =
    muscleGroups.length > 0
      ? getMuscleColor(muscleGroups[0], colors.primary).text
      : colors.primary;

  const workoutIcon = getWorkoutIcon(workout.title);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(workout)}
      activeOpacity={0.75}
    >
      {/* Barra lateral colorida */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.cardInner}>
        {/* Cabeçalho: ícone + título + data */}
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <View style={[styles.iconBadge, { backgroundColor: `${accentColor}18` }]}>
              <Text style={styles.iconText}>{workoutIcon}</Text>
            </View>
            <View style={styles.titleStack}>
              <Text style={styles.title} numberOfLines={1}>
                {tRoutine(workout.title)}
              </Text>
              <Text style={styles.date}>{formatDisplayDate(workout.date, language)}</Text>
            </View>
          </View>
          <View style={styles.arrowBadge}>
            <Text style={[styles.arrowText, { color: accentColor }]}>›</Text>
          </View>
        </View>

        {/* Notas */}
        {workout.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {workout.notes}
          </Text>
        ) : null}

        {/* Tags de grupos musculares — traduzidas e coloridas individualmente */}
        {muscleGroups.length > 0 ? (
          <View style={styles.tagsContainer}>
            {muscleGroups.map((group) => {
              const mc = getMuscleColor(group, colors.primary);
              return (
                <View
                  key={group}
                  style={[styles.tagBadge, { backgroundColor: mc.bg, borderColor: mc.border }]}
                >
                  <Text style={[styles.tagText, { color: mc.text }]}>
                    {tMuscle(group)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Métricas */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{exerciseCount}</Text>
            <Text style={styles.metricLabel}>{t('history.cardExercises')}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{totalSets}</Text>
            <Text style={styles.metricLabel}>{t('history.cardSets')}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: accentColor }]}>
              {formatWeight(totalVolume)}
            </Text>
            <Text style={styles.metricLabel}>{t('history.cardVolume')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      marginBottom: 12,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    // Barra lateral colorida
    accentBar: {
      width: 4,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    cardInner: {
      flex: 1,
      padding: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    titleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    iconBadge: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconText: {
      fontSize: 18,
    },
    titleStack: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    date: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    arrowBadge: {
      paddingLeft: 8,
    },
    arrowText: {
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 24,
    },
    notes: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 10,
      fontStyle: 'italic',
      lineHeight: 17,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    tagBadge: {
      paddingVertical: 3,
      paddingHorizontal: 9,
      borderRadius: 20,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    metricItem: {
      flex: 1,
      alignItems: 'center',
      gap: 1,
    },
    metricDivider: {
      width: 1,
      height: 22,
      backgroundColor: colors.surfaceBorder,
    },
    metricLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    metricValue: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.textPrimary,
    },
  });
}

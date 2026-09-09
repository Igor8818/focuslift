import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { type WorkoutWithDetails } from '../database/db';
import { Colors } from '../theme/colors';

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
 * Formata um número de volume com separadores amigáveis (ex.: 4.850 kg ou 4,8 t).
 */
export function formatVolumeKg(volumeKg: number): string {
  if (volumeKg >= 10000) {
    return `${(volumeKg / 1000).toFixed(1).replace('.', ',')} t`;
  }
  return `${volumeKg.toLocaleString('pt-BR')} kg`;
}

/**
 * Formata uma data ISO ou string YYYY-MM-DD para exibição amigável em português.
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onPress,
}) => {
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

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(workout)}
      activeOpacity={0.8}
    >
      {/* Cabeçalho do Card */}
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={styles.date}>{formatDisplayDate(workout.date)}</Text>
      </View>

      {/* Notas / Observações se existirem */}
      {workout.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {workout.notes}
        </Text>
      ) : null}

      {/* Grupos musculares */}
      {muscleGroups.length > 0 ? (
        <View style={styles.tagsContainer}>
          {muscleGroups.map((group) => (
            <View key={group} style={styles.tagBadge}>
              <Text style={styles.tagText}>{group}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Métricas Principais (Exercícios, Séries, Volume) */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>EXERCÍCIOS</Text>
          <Text style={styles.metricValue}>
            {exerciseCount}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>SÉRIES</Text>
          <Text style={styles.metricValue}>
            {totalSets}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>VOLUME TOTAL</Text>
          <Text style={[styles.metricValue, styles.volumeHighlight]}>
            {formatVolumeKg(totalVolume)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  notes: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagBadge: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tagText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.surfaceBorder,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  volumeHighlight: {
    color: Colors.primary,
  },
});

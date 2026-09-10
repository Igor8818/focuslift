import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { type DailyHabits } from '../database/db';
import { Colors } from '../theme/colors';

export interface HabitsCompactBarProps {
  habits: DailyHabits | null;
  onToggleHabit: (key: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done') => void;
}

interface HabitConfig {
  key: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done';
  label: string;
  icon: string;
  color: string;
}

const HABITS_CONFIG: HabitConfig[] = [
  { key: 'protein_done', label: 'Proteína', icon: '🍗', color: Colors.protein },
  { key: 'water_done', label: 'Água', icon: '💧', color: Colors.water },
  { key: 'workout_done', label: 'Treino', icon: '🏋️', color: Colors.workout },
  { key: 'meals_done', label: 'Refeições', icon: '🥗', color: Colors.meals },
];

export const HabitsCompactBar: React.FC<HabitsCompactBarProps> = ({
  habits,
  onToggleHabit,
}) => {
  const completedCount = HABITS_CONFIG.filter(
    (h) => !!(habits && habits[h.key])
  ).length;
  const totalCount = HABITS_CONFIG.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <View style={styles.container}>
      {/* Cabeçalho Minimalista */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>HÁBITOS DO DIA</Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {completedCount}/{totalCount} • {progressPercent}%
          </Text>
        </View>
      </View>

      {/* 4 Chips de Hábitos em Linha Horizontal */}
      <View style={styles.chipsRow}>
        {HABITS_CONFIG.map((item) => {
          const isDone = !!(habits && habits[item.key]);

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.chip,
                isDone && {
                  borderColor: item.color,
                  backgroundColor: `${item.color}15`,
                },
              ]}
              onPress={() => onToggleHabit(item.key)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={`${item.label}: ${isDone ? 'concluído' : 'pendente'}`}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.chipIcon}>{item.icon}</Text>
                {isDone ? (
                  <View
                    style={[
                      styles.checkIndicator,
                      { backgroundColor: item.color },
                    ]}
                  >
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.chipLabel,
                  isDone && { color: Colors.textPrimary, fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  progressBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  chipIcon: {
    fontSize: 20,
  },
  checkIndicator: {
    position: 'absolute',
    top: -3,
    right: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    color: '#0A0D14',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

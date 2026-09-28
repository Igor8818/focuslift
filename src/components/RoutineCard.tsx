import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { type RoutineWithExercises } from '../database/db';
import { useTheme } from '../contexts/ThemeContext';

export interface RoutineCardProps {
  routine: RoutineWithExercises;
  onStartRoutine: (routine: RoutineWithExercises) => void;
  onPressDetails?: (routine: RoutineWithExercises) => void;
  onEdit?: (routine: RoutineWithExercises) => void;
  onDelete?: (routine: RoutineWithExercises) => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({
  routine,
  onStartRoutine,
  onPressDetails,
  onEdit,
  onDelete,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const cardColor = routine.color || colors.primary;
  const exercises = routine.exercises || [];
  const exerciseCount = exercises.length;

  const totalTargetSets = exercises.reduce(
    (acc, ex) => acc + (ex.target_sets || 3),
    0
  );

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderTopColor: cardColor, borderTopWidth: 3 },
      ]}
      onPress={() => onPressDetails?.(routine)}
      activeOpacity={0.85}
    >
      {/* Cabeçalho do Card da Ficha */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badgePill,
            { backgroundColor: `${cardColor}20`, borderColor: `${cardColor}40` },
          ]}
        >
          <Text style={[styles.badgePillText, { color: cardColor }]}>
            ⚡ {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
          </Text>
        </View>

        {/* Ações de Edição e Exclusão */}
        <View style={styles.headerActions}>
          {onEdit ? (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => onEdit(routine)}
              activeOpacity={0.7}
              accessibilityLabel="Editar Ficha"
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
          ) : null}

          {onDelete ? (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                Alert.alert(
                  'Excluir Ficha',
                  `Tem certeza que deseja excluir a ficha "${routine.name}"? Esta ação não pode ser desfeita.`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: () => onDelete(routine),
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
              accessibilityLabel="Excluir Ficha"
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text style={styles.setsText}>{totalTargetSets} séries estimadas</Text>

      {/* Nome e Descrição da Ficha */}
      <Text style={styles.routineTitle} numberOfLines={2}>
        {routine.name}
      </Text>
      {routine.description ? (
        <Text style={styles.routineDesc} numberOfLines={2}>
          {routine.description}
        </Text>
      ) : null}

      {/* Preview dos Exercícios Planejados */}
      <View style={styles.previewContainer}>
        {exercises.slice(0, 3).map((ex, idx) => (
          <View key={ex.id || idx} style={styles.previewItem}>
            <View style={[styles.previewDot, { backgroundColor: cardColor }]} />
            <Text style={styles.previewText} numberOfLines={1}>
              {ex.exercise_name}
            </Text>
            <Text style={styles.previewSets}>{ex.target_sets}x</Text>
          </View>
        ))}

        {exercises.length > 3 ? (
          <Text style={styles.moreExercisesText}>
            + {exercises.length - 3} outros exercícios
          </Text>
        ) : null}
      </View>

      {/* Botão de Ação Direta: Iniciar Treino */}
      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: cardColor }]}
        onPress={() => onStartRoutine(routine)}
        activeOpacity={0.8}
      >
        <Text style={styles.startBtnIcon}>▶</Text>
        <Text style={styles.startBtnText}>INICIAR TREINO</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    width: Dimensions.get('window').width * 0.85,
    padding: 16,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 13,
  },
  badgePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  setsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
    minHeight: 44,
  },
  routineDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
    minHeight: 32,
  },
  previewContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  previewText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  previewSets: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 6,
  },
  moreExercisesText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 14,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
    marginTop: 2,
  },
  startBtnIcon: {
    color: '#0A0D14',
    fontSize: 13,
    fontWeight: '900',
  },
  startBtnText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
}


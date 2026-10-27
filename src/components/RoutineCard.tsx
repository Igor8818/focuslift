import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import {
  type RoutineWithExercises,
  type LastExercisePerformanceMeta,
  getLastWorkoutSetsWithMetaForExercise,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';

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
  const { colors } = useTheme();
  const { t, unit, tExercise, tRoutine, tRoutineDesc } = useTranslation();
  const styles = makeStyles(colors);
  const cardColor = routine.color || colors.primary;
  const exercises = routine.exercises || [];
  const exerciseCount = exercises.length;

  const [prevByExercise, setPrevByExercise] = useState<Record<string, LastExercisePerformanceMeta>>({});
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadPrevWeights() {
      const map: Record<string, LastExercisePerformanceMeta> = {};
      for (const ex of exercises) {
        try {
          const meta = await getLastWorkoutSetsWithMetaForExercise(ex.exercise_name, routine.name);
          if (meta && meta.sets.length > 0) {
            map[ex.exercise_name] = meta;
          }
        } catch {
          // ignore
        }
      }
      if (isMounted) {
        setPrevByExercise(map);
      }
    }
    loadPrevWeights();
    return () => {
      isMounted = false;
    };
  }, [routine.id, routine.name, exercises]);

  const totalTargetSets = exercises.reduce(
    (acc, ex) => acc + (ex.target_sets || 3),
    0
  );

  const getBestSetSummary = (exerciseName: string): string | null => {
    const meta = prevByExercise[exerciseName];
    if (!meta || meta.sets.length === 0) return null;
    let bestW = 0;
    let bestR = 0;
    for (const s of meta.sets) {
      if (s.weight > bestW || (s.weight === bestW && s.reps > bestR)) {
        bestW = s.weight;
        bestR = s.reps;
      }
    }
    if (bestW <= 0) return null;
    return `${bestW}${unit}×${bestR}`;
  };

  return (
    <>
    <TouchableOpacity
      style={[
        styles.card,
        { borderTopColor: cardColor, borderTopWidth: 3 },
      ]}
      onPress={() => {
        if (onPressDetails) {
          onPressDetails(routine);
        } else {
          setDetailsModalVisible(true);
        }
      }}
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
            {t('routineCard.badgeCount', {
              count: exerciseCount,
              label: exerciseCount === 1 ? t('routineCard.exerciseSingular') : t('routineCard.exercisePlural'),
            })}
          </Text>
        </View>

        {/* Ações de Edição e Exclusão */}
        <View style={styles.headerActions}>
          {onEdit ? (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => onEdit(routine)}
              activeOpacity={0.7}
              accessibilityLabel={t('common.edit')}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
          ) : null}

          {onDelete ? (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                Alert.alert(
                  t('routineCard.deleteTitle'),
                  t('routineCard.deleteMsg', { name: tRoutine(routine.name) }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('common.delete'),
                      style: 'destructive',
                      onPress: () => onDelete(routine),
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
              accessibilityLabel={t('common.delete')}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text style={styles.setsText}>{t('routineCard.estimatedSets', { count: totalTargetSets })}</Text>

      {/* Nome e Descrição da Ficha */}
      <Text style={styles.routineTitle} numberOfLines={2}>
        {tRoutine(routine.name)}
      </Text>
      {routine.description ? (
        <Text style={styles.routineDesc} numberOfLines={2}>
          {tRoutineDesc(routine.description)}
        </Text>
      ) : null}

      {/* Preview dos Exercícios Planejados + Última Carga da Ficha */}
      <View style={styles.previewContainer}>
        {exercises.slice(0, 3).map((ex, idx) => {
          const bestSummary = getBestSetSummary(ex.exercise_name);
          return (
            <View key={ex.id || idx} style={styles.previewItem}>
              <View style={[styles.previewDot, { backgroundColor: cardColor }]} />
              <Text style={styles.previewText} numberOfLines={1}>
                {tExercise(ex.exercise_name)}
              </Text>
              {bestSummary ? (
                <View style={styles.prevLoadPill}>
                  <Text style={styles.prevLoadPillText}>Últ: {bestSummary}</Text>
                </View>
              ) : null}
              <Text style={styles.previewSets}>{ex.target_sets}x</Text>
            </View>
          );
        })}

        {exercises.length > 3 ? (
          <Text style={styles.moreExercisesText}>
            {t('routineCard.otherExercises', { count: exercises.length - 3 })} (toque p/ ver cargas)
          </Text>
        ) : (
          <Text style={styles.moreExercisesText}>
            Toque no card para ver todas as séries anteriores
          </Text>
        )}
      </View>

      {/* Botão de Ação Direta: Iniciar Treino */}
      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: cardColor }]}
        onPress={() => onStartRoutine(routine)}
        activeOpacity={0.8}
      >
        <Text style={styles.startBtnIcon}>▶</Text>
        <Text style={styles.startBtnText}>{t('training.startWorkout')}</Text>
      </TouchableOpacity>
    </TouchableOpacity>

    {/* Modal de Detalhes e Cargas Anteriores da Ficha */}
    <Modal
      visible={detailsModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{tRoutine(routine.name)}</Text>
              <Text style={styles.modalSubtitle}>
                Cargas anteriores registradas nesta ficha
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setDetailsModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {exercises.map((ex, idx) => {
              const meta = prevByExercise[ex.exercise_name];
              return (
                <View key={ex.id || idx} style={styles.modalExerciseCard}>
                  <View style={styles.modalExHeader}>
                    <Text style={styles.modalExName}>
                      {idx + 1}. {tExercise(ex.exercise_name)}
                    </Text>
                    <Text style={styles.modalExTarget}>{ex.target_sets} séries</Text>
                  </View>
                  {meta && meta.sets.length > 0 ? (
                    <>
                      <Text style={styles.modalExSource}>
                        {meta.matchedSameRoutine
                          ? `📋 Última vez nesta ficha (${meta.workoutDate.split('-').reverse().join('/')})`
                          : `🕒 Último treino: ${meta.workoutTitle} (${meta.workoutDate.split('-').reverse().join('/')})`}
                      </Text>
                      <View style={styles.modalSetsRow}>
                        {meta.sets.map((s, sIdx) => (
                          <View key={s.id || sIdx} style={styles.modalSetChip}>
                            <Text style={styles.modalSetChipIndex}>{sIdx + 1}ª:</Text>
                            <Text style={styles.modalSetChipVal}>
                              {s.weight}{unit} × {s.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.modalNoHistory}>
                      Sem carga anterior registrada ainda
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: cardColor, marginTop: 12 }]}
            onPress={() => {
              setDetailsModalVisible(false);
              onStartRoutine(routine);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnIcon}>▶</Text>
            <Text style={styles.startBtnText}>{t('training.startWorkout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
  prevLoadPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  prevLoadPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  moreExercisesText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    padding: 20,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMuted,
  },
  modalScroll: {
    marginBottom: 4,
  },
  modalExerciseCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 12,
    marginBottom: 10,
  },
  modalExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalExName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
  },
  modalExTarget: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
  modalExSource: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  modalSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalSetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '38',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  modalSetChipIndex: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  modalSetChipVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalNoHistory: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textMuted,
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
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  startBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
}


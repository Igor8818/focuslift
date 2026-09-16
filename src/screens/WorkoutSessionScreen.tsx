import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  FlatList,
  Dimensions,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import {
  createWorkout,
  upsertDailyHabits,
  type CreateWorkoutInput,
  type CreateExerciseInput,
  type CreateSetInput,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { ExerciseBlock, type ActiveExerciseState } from '../components/ExerciseBlock';
import { RestTimerBar } from '../components/RestTimerBar';
import { COMMON_SUGGESTIONS } from '../utils/constants';

export interface WorkoutSessionScreenProps {
  initialTitle?: string;
  initialExercises?: Array<{ name: string; muscleGroup?: string; restTimerSeconds?: number }>;
  onFinish?: () => void;
  onCancel?: () => void;
}

// Sugestões rápidas: usamos os 10 primeiros do COMMON_SUGGESTIONS como atalhos populares
const POPULAR_EXERCISE_SHORTLIST = [
  'Supino Reto com Barra',
  'Agachamento Livre',
  'Levantamento Terra',
  'Desenvolvimento com Halteres',
  'Puxada Alta Aberta',
  'Remada Curvada com Barra',
  'Rosca Direta com Barra',
  'Tríceps Corda na Polia',
  'Elevação Lateral com Halteres',
  'Leg Press 45°',
];

/**
 * Formata segundos em HH:MM:SS
 */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Dispara vibração tátil ao concluir o descanso regressivo
 */
async function triggerRestHapticFeedback() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    try {
      Vibration.vibrate([0, 250, 100, 250]);
    } catch {
      // Ignora silenciosamente caso vibração não seja suportada
    }
  }
}

export const WorkoutSessionScreen: React.FC<WorkoutSessionScreenProps> = ({
  initialTitle = 'Treino de Força',
  initialExercises = [],
  onFinish,
  onCancel,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  
  // 1. Mantém a tela ativa durante a sessão de treino se disponível
  try {
    useKeepAwake();
  } catch {
    // Tratamento silencioso caso o hook não esteja disponível no ambiente
  }

  const [workoutTitle, setWorkoutTitle] = useState(initialTitle);
  const [workoutNotes, setWorkoutNotes] = useState('');
  
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  const [exercises, setExercises] = useState<ActiveExerciseState[]>(() => {
    if (initialExercises.length > 0) {
      return initialExercises.map((e) => {
        // Busca o mediaUrl correspondente no catálogo de sugestões
        const suggestion = COMMON_SUGGESTIONS.find(
          (s) => s.name.toLowerCase() === e.name.toLowerCase()
        );
        return {
          id: `${Date.now()}-${Math.random()}`,
          name: e.name,
          muscleGroup: e.muscleGroup || '',
          restTimerSeconds: e.restTimerSeconds || 90,
          mediaUrl: suggestion?.mediaUrl,
          sets: [
            {
              id: `${Date.now()}-1`,
              weight: '',
              reps: '',
              rpe: '',
              setType: 'normal',
              completed: false,
            },
          ],
        };
      });
    }
    // Inicializa com um exercício padrão caso nenhum tenha sido passado
    const defaultSuggestion = COMMON_SUGGESTIONS.find(
      (s) => s.name === 'Supino Reto com Barra'
    );
    return [
      {
        id: `${Date.now()}-init`,
        name: 'Supino Reto com Barra',
        muscleGroup: 'Peito',
        restTimerSeconds: 90,
        mediaUrl: defaultSuggestion?.mediaUrl,
        sets: [
          {
            id: `${Date.now()}-set-1`,
            weight: '',
            reps: '',
            rpe: '',
            setType: 'normal',
            completed: false,
          },
        ],
      },
    ];
  });

  // 2. Cronômetro de tempo total decorrido da sessão
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 3. Cronômetro de descanso (com cleanup e haptics)
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(90);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [isRestActive, setIsRestActive] = useState(false);
  const [restFinished, setRestFinished] = useState(false);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRestActive && restSecondsLeft > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev <= 1) {
            if (restTimerRef.current) clearInterval(restTimerRef.current);
            triggerRestHapticFeedback();
            setIsRestActive(false);
            setRestFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [isRestActive, restSecondsLeft]);

  // Disparador de descanso ao concluir uma série
  const handleStartRestTimer = (exerciseName: string, durationSeconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const secs = durationSeconds > 0 ? durationSeconds : 90;
    setRestFinished(false);
    setRestExerciseName(exerciseName);
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    setIsRestActive(true);
  };

  const handleAddRestSeconds = (delta: number) => {
    setRestSecondsLeft((prev) => {
      const next = Math.max(0, prev + delta);
      if (next > 0) {
        setRestFinished(false);
        setIsRestActive(true);
      }
      return next;
    });
    setRestTotalSeconds((prev) => Math.max(0, prev + delta));
  };

  const handleSkipRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setIsRestActive(false);
    setRestFinished(false);
    setRestSecondsLeft(0);
  };

  // Modal para adicionar novo exercício
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('');

  const handleAddExerciseToList = (name: string, muscleGroup: string, mediaUrl?: string) => {
    const newEx: ActiveExerciseState = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      muscleGroup,
      restTimerSeconds: 90,
      mediaUrl,
      sets: [
        {
          id: `${Date.now()}-set-1`,
          weight: '',
          reps: '',
          rpe: '',
          setType: 'normal',
          completed: false,
        },
      ],
    };

    setExercises((prev) => [...prev, newEx]);
    setIsAddModalVisible(false);
    setCustomExerciseName('');
    setCustomMuscleGroup('');
  };

  // Finalização do treino e persistência
  const [isSaving, setIsSaving] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<{
    title: string;
    duration: string;
    totalVolume: number;
    totalSets: number;
  } | null>(null);

  const handleFinishWorkout = async () => {
    // Filtra e valida se há exercícios com séries válidas
    const validExercises: CreateExerciseInput[] = [];
    let totalVolumeKg = 0;
    let completedSetsCount = 0;

    for (const ex of exercises) {
      const validSets: CreateSetInput[] = [];

      for (const s of ex.sets) {
        const weight = parseFloat(s.weight.replace(',', '.'));
        const reps = parseInt(s.reps, 10);

        if (!isNaN(weight) && weight >= 0 && !isNaN(reps) && reps > 0) {
          let rpe: number | null = null;
          if (s.rpe && typeof s.rpe === 'string' && s.rpe.trim().length > 0) {
            const parsedRpe = parseFloat(s.rpe.replace(',', '.'));
            if (!isNaN(parsedRpe)) {
              rpe = parsedRpe;
            }
          }

          validSets.push({
            weight,
            reps,
            rpe: rpe ?? null,
            set_type: (s.setType && s.setType.trim().length > 0) ? s.setType.trim() : 'normal',
            completed_at: (s.completedAt && s.completedAt.trim().length > 0) ? s.completedAt.trim() : new Date().toISOString(),
          });

          totalVolumeKg += weight * reps;
          completedSetsCount++;
        }
      }

      if (validSets.length > 0) {
        const muscleGroup = (ex.muscleGroup && ex.muscleGroup.trim().length > 0) ? ex.muscleGroup.trim() : null;
        const restTimer = typeof ex.restTimerSeconds === 'number' && !isNaN(ex.restTimerSeconds) ? ex.restTimerSeconds : 90;

        validExercises.push({
          name: (ex.name && ex.name.trim().length > 0) ? ex.name.trim() : 'Exercício',
          muscle_group: muscleGroup ?? null,
          rest_timer_seconds: restTimer,
          sets: validSets,
        });
      }
    }

    if (validExercises.length === 0) {
      Alert.alert(
        'Treino Vazio',
        'Preencha o peso e as repetições de pelo menos uma série antes de concluir o treino.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];

      const workoutInput: CreateWorkoutInput = {
        title: (workoutTitle && workoutTitle.trim().length > 0) ? workoutTitle.trim() : 'Treino Concluído',
        date: todayIso,
        notes: (workoutNotes && workoutNotes.trim().length > 0) ? workoutNotes.trim() : null,
        exercises: validExercises,
      };

      // 1. Salva o treino com exercícios e séries de forma atômica no SQLite
      await createWorkout(workoutInput);

      // 2. Marca o hábito diário de treino como realizado
      try {
        await upsertDailyHabits({
          date: todayIso,
          workout_done: 1,
        });
      } catch (habitErr) {
        console.warn('Aviso: Treino salvo com sucesso, mas falhou ao atualizar hábito diário:', habitErr);
      }

      // 3. Exibe o resumo do treino
      setWorkoutSummary({
        title: workoutInput.title,
        duration: formatDuration(elapsedSeconds),
        totalVolume: Math.round(totalVolumeKg),
        totalSets: completedSetsCount,
      });
      setSummaryModalVisible(true);
    } catch (error) {
      console.error('Erro ao salvar o treino no banco:', error);
      Alert.alert(
        'Erro ao Concluir Treino',
        'Não foi possível salvar o treino no banco de dados. Por favor, tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* =================================================================
          BARRA DE TOPO DA SESSÃO
          ================================================================= */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            Alert.alert(
              'Descartar Treino',
              'Tem certeza que deseja cancelar? O progresso desta sessão não será salvo.',
              [
                { text: 'Continuar Treinando', style: 'cancel' },
                { text: 'Descartar', style: 'destructive', onPress: onCancel },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Descartar</Text>
        </TouchableOpacity>

        <View style={styles.stepIndicatorBadge}>
          <Text style={styles.stepIndicatorText}>
            {exercises.length > 0 ? `${currentExerciseIndex + 1} / ${exercises.length}` : '0 / 0'}
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <View style={styles.elapsedBadge}>
            <Text style={styles.elapsedIcon}>⏱️</Text>
            <Text style={styles.elapsedText}>{formatDuration(elapsedSeconds)}</Text>
          </View>
          <TouchableOpacity
            style={styles.addExerciseTopBtn}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addExerciseTopBtnIcon}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* =================================================================
          CONTEÚDO ROLÁVEL DO TREINO
          ================================================================= */}
      <View style={styles.titleCard}>
        <TextInput
          style={styles.workoutTitleInput}
          value={workoutTitle}
          onChangeText={setWorkoutTitle}
          placeholder="Nome do Treino"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={styles.workoutNotesInput}
          value={workoutNotes}
          onChangeText={setWorkoutNotes}
          placeholder="Adicionar anotações sobre o treino..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={exercises}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => {
          const contentOffsetX = e.nativeEvent.contentOffset.x;
          const newIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
          if (newIndex !== currentExerciseIndex) {
            setCurrentExerciseIndex(newIndex);
          }
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item: exercise, index }) => (
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <ScrollView 
              contentContainerStyle={[
                styles.scrollContent,
                { flexGrow: 1 },
                (isRestActive || restSecondsLeft > 0 || restFinished) && { paddingBottom: 130 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ExerciseBlock
                exercise={exercise}
                index={index}
                onUpdateExercise={(updated) => {
                  setExercises((prev) =>
                    prev.map((e) => (e.id === updated.id ? updated : e))
                  );
                }}
                onRemoveExercise={(id) => {
                  setExercises((prev) => prev.filter((e) => e.id !== id));
                  if (currentExerciseIndex >= exercises.length - 1 && currentExerciseIndex > 0) {
                    const prevIdx = currentExerciseIndex - 1;
                    flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true });
                    setCurrentExerciseIndex(prevIdx);
                  }
                }}
                onSetCompleted={handleStartRestTimer}
              />

              <View style={styles.navigationRow}>
                <TouchableOpacity
                  style={[styles.navBtn, currentExerciseIndex === 0 && styles.navBtnDisabled]}
                  onPress={() => {
                    if (currentExerciseIndex > 0) {
                      flatListRef.current?.scrollToIndex({ index: currentExerciseIndex - 1, animated: true });
                      setCurrentExerciseIndex(currentExerciseIndex - 1);
                    }
                  }}
                  disabled={currentExerciseIndex === 0}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.navBtnText, currentExerciseIndex === 0 && styles.navBtnTextDisabled]}>
                    Anterior
                  </Text>
                </TouchableOpacity>

                {currentExerciseIndex === exercises.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.navBtn, styles.finishNavBtn]}
                    onPress={handleFinishWorkout}
                    disabled={isSaving}
                    activeOpacity={0.8}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#0A0D14" />
                    ) : (
                      <Text style={styles.finishNavBtnText}>Finalizar Treino</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.navBtn, styles.nextNavBtn]}
                    onPress={() => {
                      if (currentExerciseIndex < exercises.length - 1) {
                        flatListRef.current?.scrollToIndex({ index: currentExerciseIndex + 1, animated: true });
                        setCurrentExerciseIndex(currentExerciseIndex + 1);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nextNavBtnText}>Próximo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      />

      {/* =================================================================
          BARRA FLUTUANTE DE CRONÔMETRO DE DESCANSO
          ================================================================= */}
      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotalSeconds}
        exerciseName={restExerciseName}
        isActive={isRestActive}
        isFinished={restFinished}
        onAddSeconds={handleAddRestSeconds}
        onSkip={handleSkipRest}
      />

      {/* =================================================================
          MODAL PARA ADICIONAR EXERCÍCIO
          ================================================================= */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Exercício</Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Criação Rápida Personalizada */}
            <View style={styles.customAddContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Nome do exercício customizado"
                placeholderTextColor={colors.textMuted}
                value={customExerciseName}
                onChangeText={setCustomExerciseName}
              />
              <TextInput
                style={styles.customInput}
                placeholder="Grupo muscular (ex.: Peito, Costas)"
                placeholderTextColor={colors.textMuted}
                value={customMuscleGroup}
                onChangeText={setCustomMuscleGroup}
              />
              <TouchableOpacity
                style={[
                  styles.confirmAddBtn,
                  !customExerciseName.trim() && styles.confirmAddBtnDisabled,
                ]}
                disabled={!customExerciseName.trim()}
                onPress={() =>
                  handleAddExerciseToList(
                    customExerciseName.trim(),
                    customMuscleGroup.trim(),
                    undefined  // exercício personalizado não tem mediaUrl
                  )
                }
              >
                <Text style={styles.confirmAddBtnText}>Adicionar Customizado</Text>
              </TouchableOpacity>
            </View>

            {/* Sugestões Rápidas */}
            <Text style={styles.suggestionsHeader}>EXERCÍCIOS POPULARES</Text>
            <ScrollView style={styles.suggestionsList}>
              {POPULAR_EXERCISE_SHORTLIST.map((name) => {
                const suggestion = COMMON_SUGGESTIONS.find((s) => s.name === name);
                if (!suggestion) return null;
                return (
                  <TouchableOpacity
                    key={suggestion.name}
                    style={styles.suggestionItem}
                    onPress={() => handleAddExerciseToList(suggestion.name, suggestion.group, suggestion.mediaUrl)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.suggestionName}>{suggestion.name}</Text>
                      <Text style={styles.suggestionGroup}>{suggestion.group}</Text>
                    </View>
                    <Text style={styles.suggestionPlus}>+</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================================
          MODAL DE RESUMO DO TREINO CONCLUÍDO
          ================================================================= */}
      <Modal
        visible={summaryModalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.summaryCard}>
            <View style={styles.trophyCircle}>
              <Text style={styles.trophyIcon}>🏆</Text>
            </View>

            <Text style={styles.summaryTitle}>Treino Concluído!</Text>
            <Text style={styles.summarySubtitle}>
              Excelente trabalho! Seus registros foram salvos e o hábito diário de treino foi marcado.
            </Text>

            {workoutSummary ? (
              <View style={styles.summaryMetricsGrid}>
                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>TEMPO</Text>
                  <Text style={styles.summaryMetricValue}>
                    {workoutSummary.duration}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>SÉRIES</Text>
                  <Text style={styles.summaryMetricValue}>
                    {workoutSummary.totalSets}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>VOLUME</Text>
                  <Text style={[styles.summaryMetricValue, styles.summaryVolumeHighlight]}>
                    {workoutSummary.totalVolume.toLocaleString('pt-BR')} kg
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.finishDialogBtn}
              onPress={() => {
                setSummaryModalVisible(false);
                onFinish?.();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.finishDialogBtnText}>Voltar ao Início</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elapsedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  elapsedIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  elapsedText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  stepIndicatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  stepIndicatorText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  addExerciseTopBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addExerciseTopBtnIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  titleCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  workoutTitleInput: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    paddingVertical: 4,
  },
  workoutNotesInput: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
    paddingVertical: 4,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  navBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  nextNavBtn: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  nextNavBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  finishNavBtn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  finishNavBtnText: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
    padding: 4,
  },
  customAddContainer: {
    marginBottom: 20,
  },
  customInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  confirmAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmAddBtnDisabled: {
    opacity: 0.5,
  },
  confirmAddBtnText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '800',
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  suggestionsList: {
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  suggestionGroup: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  suggestionPlus: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.success,
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.success,
  },
  trophyIcon: {
    fontSize: 36,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  summaryMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 22,
  },
  summaryMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.surfaceBorder,
  },
  summaryMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  summaryMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  summaryVolumeHighlight: {
    color: colors.primary,
  },
  finishDialogBtn: {
    backgroundColor: colors.success,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  finishDialogBtnText: {
    color: '#0A0D14',
    fontSize: 16,
    fontWeight: '900',
  },
});
}


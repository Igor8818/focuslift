import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AppState,
  AppStateStatus,
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
import {
  requestNotificationPermission,
  scheduleRestNotification,
  cancelRestNotification,
} from '../services/notificationService';

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

  // 2. Cronômetro de tempo total decorrido da sessão (usando timestamp para precisão)
  const sessionStartRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2b. Solicita permissão de notificação no mount da sessão de treino.
  // Também cancela qualquer notificação pendente no unmount (ex.: usuário
  // descarta o treino antes do timer zerar).
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
    return () => {
      cancelRestNotification().catch(() => {});
    };
  }, []);

  // 3. Cronômetro de descanso baseado em timestamps — resiliente a background/foreground
  //    Em vez de decrementar um contador, registramos o instante em que o timer começou
  //    e calculamos o restante como: total - (agora - inicio). Isso garante que ao voltar
  //    ao foreground o display mostre o tempo correto mesmo se o JS foi suspenso.
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(90);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [isRestActive, setIsRestActive] = useState(false);
  const [restFinished, setRestFinished] = useState(false);

  // Refs para manter valores atualizados dentro de callbacks/listeners
  const restStartTimestampRef = useRef<number | null>(null); // Date.now() quando o timer começou
  const restDurationRef = useRef<number>(0);                 // duração total em segundos
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRestActiveRef = useRef(false);

  // Calcula e aplica o tempo restante a partir do timestamp de início
  const syncRestTimer = useCallback(() => {
    if (!isRestActiveRef.current || restStartTimestampRef.current === null) return;
    const elapsed = Math.floor((Date.now() - restStartTimestampRef.current) / 1000);
    const remaining = Math.max(0, restDurationRef.current - elapsed);
    setRestSecondsLeft(remaining);
    if (remaining <= 0) {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      triggerRestHapticFeedback();
      cancelRestNotification().catch(() => {});
      isRestActiveRef.current = false;
      setIsRestActive(false);
      setRestFinished(true);
    }
  }, []);

  // Tick de 1 segundo para atualizar o display enquanto app está em foreground
  useEffect(() => {
    if (isRestActive) {
      restTimerRef.current = setInterval(syncRestTimer, 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [isRestActive, syncRestTimer]);

  // AppState listener: ao voltar ao foreground, sincroniza o timer imediatamente
  // Isso evita o display "congelado" no valor anterior após o app ser minimizado
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncRestTimer();
      }
    });
    return () => subscription.remove();
  }, [syncRestTimer]);

  // Disparador de descanso ao concluir uma série
  const handleStartRestTimer = (exerciseName: string, durationSeconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const secs = durationSeconds > 0 ? durationSeconds : 90;

    // Registra o instante de início e a duração total
    restStartTimestampRef.current = Date.now();
    restDurationRef.current = secs;
    isRestActiveRef.current = true;

    setRestFinished(false);
    setRestExerciseName(exerciseName);
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    setIsRestActive(true);
    scheduleRestNotification(exerciseName, secs).catch(() => {});
  };

  const handleAddRestSeconds = (delta: number) => {
    if (restStartTimestampRef.current === null) return;
    // Ajusta a duração total sem mover o timestamp de início
    const newDuration = Math.max(0, restDurationRef.current + delta);
    restDurationRef.current = newDuration;
    setRestTotalSeconds(newDuration);

    const elapsed = Math.floor((Date.now() - restStartTimestampRef.current) / 1000);
    const newRemaining = Math.max(0, newDuration - elapsed);
    setRestSecondsLeft(newRemaining);

    if (newRemaining > 0) {
      setRestFinished(false);
      isRestActiveRef.current = true;
      setIsRestActive(true);
      scheduleRestNotification(restExerciseName, newRemaining).catch(() => {});
    } else {
      cancelRestNotification().catch(() => {});
      isRestActiveRef.current = false;
      setIsRestActive(false);
      setRestFinished(true);
    }
  };

  const handleSkipRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    cancelRestNotification().catch(() => {});
    restStartTimestampRef.current = null;
    isRestActiveRef.current = false;
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
          BARRA DE TOPO DA SESSÃO — redesenhada
          ================================================================= */}
      <View style={styles.topBar}>
        {/* Esquerda: Descartar */}
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
          <Text style={styles.cancelButtonText}>✕ Descartar</Text>
        </TouchableOpacity>

        {/* Centro: Cronômetro de sessão */}
        <View style={styles.elapsedBadge}>
          <Text style={styles.elapsedIcon}>⏱</Text>
          <Text style={styles.elapsedText}>{formatDuration(elapsedSeconds)}</Text>
        </View>

        {/* Direita: Adicionar exercício */}
        <TouchableOpacity
          style={styles.addExerciseTopBtn}
          onPress={() => setIsAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addExerciseTopBtnText}>+ Exercício</Text>
        </TouchableOpacity>
      </View>

      {/* =================================================================
          CABEÇALHO DO TREINO (título + notas + progress)
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
          placeholder="Observações do treino..."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        {/* Progress dots + label de exercício atual */}
        {exercises.length > 0 && (
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              Exercício {currentExerciseIndex + 1} de {exercises.length}
            </Text>
            <View style={styles.dotsRow}>
              {exercises.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    flatListRef.current?.scrollToIndex({ index: i, animated: true });
                    setCurrentExerciseIndex(i);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View
                    style={[
                      styles.dot,
                      i === currentExerciseIndex && styles.dotActive,
                      i < currentExerciseIndex && styles.dotDone,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
                (isRestActive || restSecondsLeft > 0 || restFinished) && { paddingBottom: 140 },
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

              {/* Navegação entre exercícios — redesenhada */}
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
                    ← Anterior
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
                      <Text style={styles.finishNavBtnText}>🏁 Finalizar Treino</Text>
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
                    <Text style={styles.nextNavBtnText}>Próximo →</Text>
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

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.07)',
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  elapsedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 5,
  },
  elapsedIcon: {
    fontSize: 13,
  },
  elapsedText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  addExerciseTopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  addExerciseTopBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },

  // ── Title Card ──
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  titleCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  workoutTitleInput: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    paddingVertical: 2,
  },
  workoutNotesInput: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    paddingVertical: 2,
  },

  // ── Progress Dots ──
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceBorder,
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.success,
  },

  // ── Navigation Row ──
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  navBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  nextNavBtn: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  nextNavBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  finishNavBtn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
    borderWidth: 1.5,
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


import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
  createWorkout,
  upsertDailyHabits,
  type CreateWorkoutInput,
  type CreateExerciseInput,
  type CreateSetInput,
} from '../database/db';
import { Colors } from '../theme/colors';
import { ExerciseBlock, type ActiveExerciseState } from '../components/ExerciseBlock';
import { RestTimerBar } from '../components/RestTimerBar';

export interface WorkoutSessionScreenProps {
  initialTitle?: string;
  initialExercises?: Array<{ name: string; muscleGroup?: string; restTimerSeconds?: number }>;
  onFinish?: () => void;
  onCancel?: () => void;
}

/**
 * Sugestões rápidas de exercícios comuns
 */
const COMMON_EXERCISE_SUGGESTIONS = [
  { name: 'Supino Reto com Barra', muscleGroup: 'Peito' },
  { name: 'Agachamento Livre', muscleGroup: 'Pernas' },
  { name: 'Levantamento Terra', muscleGroup: 'Costas / Posterior' },
  { name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros' },
  { name: 'Puxada Alta na Barra', muscleGroup: 'Costas' },
  { name: 'Remada Curvada com Barra', muscleGroup: 'Costas' },
  { name: 'Rosca Direta', muscleGroup: 'Bíceps' },
  { name: 'Tríceps Corda', muscleGroup: 'Tríceps' },
  { name: 'Elevação Lateral', muscleGroup: 'Ombros' },
  { name: 'Leg Press 45°', muscleGroup: 'Pernas' },
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

export const WorkoutSessionScreen: React.FC<WorkoutSessionScreenProps> = ({
  initialTitle = 'Treino de Força',
  initialExercises = [],
  onFinish,
  onCancel,
}) => {
  // 1. Mantém a tela ativa durante a sessão de treino se disponível
  try {
    useKeepAwake();
  } catch {
    // Tratamento silencioso caso o hook não esteja disponível no ambiente
  }

  const [workoutTitle, setWorkoutTitle] = useState(initialTitle);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [exercises, setExercises] = useState<ActiveExerciseState[]>(() => {
    if (initialExercises.length > 0) {
      return initialExercises.map((e) => ({
        id: `${Date.now()}-${Math.random()}`,
        name: e.name,
        muscleGroup: e.muscleGroup || '',
        restTimerSeconds: e.restTimerSeconds || 90,
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
      }));
    }
    // Inicializa com um exercício padrão caso nenhum tenha sido passado
    return [
      {
        id: `${Date.now()}-init`,
        name: 'Supino Reto com Barra',
        muscleGroup: 'Peito',
        restTimerSeconds: 90,
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

  // 2. Cronômetro da sessão decorrida (com cleanup para evitar memory leaks)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // 3. Cronômetro de descanso (com cleanup para evitar memory leaks)
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(90);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [isRestActive, setIsRestActive] = useState(false);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRestActive && restSecondsLeft > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRestActive(false);
            if (restTimerRef.current) clearInterval(restTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (restSecondsLeft === 0) {
      setIsRestActive(false);
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [isRestActive, restSecondsLeft]);

  // Disparador de descanso ao concluir uma série
  const handleStartRestTimer = (exerciseName: string, durationSeconds: number) => {
    setRestExerciseName(exerciseName);
    setRestTotalSeconds(durationSeconds);
    setRestSecondsLeft(durationSeconds);
    setIsRestActive(true);
  };

  const handleAddRestSeconds = (delta: number) => {
    setRestSecondsLeft((prev) => Math.max(0, prev + delta));
    setRestTotalSeconds((prev) => Math.max(0, prev + delta));
  };

  const handleSkipRest = () => {
    setIsRestActive(false);
    setRestSecondsLeft(0);
  };

  // Modal para adicionar novo exercício
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('');

  const handleAddExerciseToList = (name: string, muscleGroup: string) => {
    const newEx: ActiveExerciseState = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      muscleGroup,
      restTimerSeconds: 90,
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
          validSets.push({
            weight,
            reps,
            rpe: s.rpe ? parseFloat(s.rpe.replace(',', '.')) : null,
            set_type: s.setType,
            completed_at: s.completedAt || new Date().toISOString(),
          });

          totalVolumeKg += weight * reps;
          completedSetsCount++;
        }
      }

      if (validSets.length > 0) {
        validExercises.push({
          name: ex.name,
          muscle_group: ex.muscleGroup || null,
          rest_timer_seconds: ex.restTimerSeconds,
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
        title: workoutTitle.trim() || 'Treino Concluído',
        date: todayIso,
        notes: workoutNotes.trim() || null,
        exercises: validExercises,
      };

      // 1. Salva o treino com exercícios e séries de forma atômica no SQLite
      await createWorkout(workoutInput);

      // 2. Marca o hábito diário de treino como realizado
      await upsertDailyHabits({
        date: todayIso,
        workout_done: 1,
      });

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
      Alert.alert('Erro', 'Não foi possível salvar o treino. Tente novamente.');
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

        <View style={styles.elapsedBadge}>
          <Text style={styles.elapsedIcon}>⏱️</Text>
          <Text style={styles.elapsedText}>{formatDuration(elapsedSeconds)}</Text>
        </View>

        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinishWorkout}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#0A0D14" />
          ) : (
            <Text style={styles.finishButtonText}>Concluir</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* =================================================================
          CONTEÚDO ROLÁVEL DO TREINO
          ================================================================= */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          (isRestActive || restSecondsLeft > 0) && { paddingBottom: 130 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Título do Treino Editável */}
        <View style={styles.titleCard}>
          <TextInput
            style={styles.workoutTitleInput}
            value={workoutTitle}
            onChangeText={setWorkoutTitle}
            placeholder="Nome do Treino"
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={styles.workoutNotesInput}
            value={workoutNotes}
            onChangeText={setWorkoutNotes}
            placeholder="Adicionar anotações sobre o treino..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
        </View>

        {/* Blocos de Exercícios */}
        {exercises.map((exercise, index) => (
          <ExerciseBlock
            key={exercise.id}
            exercise={exercise}
            index={index}
            onUpdateExercise={(updated) => {
              setExercises((prev) =>
                prev.map((e) => (e.id === updated.id ? updated : e))
              );
            }}
            onRemoveExercise={(id) => {
              setExercises((prev) => prev.filter((e) => e.id !== id));
            }}
            onSetCompleted={handleStartRestTimer}
          />
        ))}

        {/* Botão Adicionar Exercício */}
        <TouchableOpacity
          style={styles.addExerciseCardBtn}
          onPress={() => setIsAddModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addExerciseCardIcon}>+</Text>
          <Text style={styles.addExerciseCardText}>Adicionar Exercício</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* =================================================================
          BARRA FLUTUANTE DE CRONÔMETRO DE DESCANSO
          ================================================================= */}
      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotalSeconds}
        exerciseName={restExerciseName}
        isActive={isRestActive}
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
                placeholderTextColor={Colors.textMuted}
                value={customExerciseName}
                onChangeText={setCustomExerciseName}
              />
              <TextInput
                style={styles.customInput}
                placeholder="Grupo muscular (ex.: Peito, Costas)"
                placeholderTextColor={Colors.textMuted}
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
                    customMuscleGroup.trim()
                  )
                }
              >
                <Text style={styles.confirmAddBtnText}>Adicionar Customizado</Text>
              </TouchableOpacity>
            </View>

            {/* Sugestões Rápidas */}
            <Text style={styles.suggestionsHeader}>EXERCÍCIOS POPULARES</Text>
            <ScrollView style={styles.suggestionsList}>
              {COMMON_EXERCISE_SUGGESTIONS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.suggestionItem}
                  onPress={() => handleAddExerciseToList(item.name, item.muscleGroup)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionGroup}>{item.muscleGroup}</Text>
                  </View>
                  <Text style={styles.suggestionPlus}>+</Text>
                </TouchableOpacity>
              ))}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  elapsedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  elapsedIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  elapsedText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    backgroundColor: Colors.success,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  finishButtonText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  titleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 16,
  },
  workoutTitleInput: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    paddingVertical: 4,
  },
  workoutNotesInput: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
    paddingVertical: 4,
  },
  addExerciseCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    paddingVertical: 16,
    marginBottom: 24,
  },
  addExerciseCardIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
    marginRight: 8,
  },
  addExerciseCardText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
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
    color: Colors.textPrimary,
  },
  modalCloseText: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
    padding: 4,
  },
  customAddContainer: {
    marginBottom: 20,
  },
  customInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    color: Colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  confirmAddBtn: {
    backgroundColor: Colors.primary,
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
    color: Colors.textMuted,
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  suggestionGroup: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  suggestionPlus: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.success,
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
    borderColor: Colors.success,
  },
  trophyIcon: {
    fontSize: 36,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  summaryMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
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
    backgroundColor: Colors.surfaceBorder,
  },
  summaryMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  summaryMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  summaryVolumeHighlight: {
    color: Colors.primary,
  },
  finishDialogBtn: {
    backgroundColor: Colors.success,
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

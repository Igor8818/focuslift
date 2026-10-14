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
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import {
  createWorkout,
  upsertDailyHabits,
  getLastWorkoutSetsForExercise,
  type CreateWorkoutInput,
  type CreateExerciseInput,
  type CreateSetInput,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { ExerciseBlock, type ActiveExerciseState } from '../components/ExerciseBlock';
import { RestTimerBar } from '../components/RestTimerBar';
import { COMMON_SUGGESTIONS } from '../utils/constants';
import {
  requestNotificationPermission,
  scheduleRestNotification,
  cancelRestNotification,
} from '../services/notificationService';
import { ExerciseSearchInput } from '../components/ExerciseSearchInput';
import { WorkoutShareModal } from '../components/WorkoutShareModal';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { autoSyncAfterWorkout } from '../services/autoSyncService';

export interface WorkoutSessionScreenProps {
  initialTitle?: string;
  initialExercises?: Array<{ name: string; muscleGroup?: string; restTimerSeconds?: number; mediaUrl?: string }>;
  onFinish?: () => void;
  onCancel?: () => void;
}

function isPerSideByDefault(name: string): boolean {
  return /halter|unilateral|leg press|smith|anilha/i.test(name);
}

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

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {}
}

async function triggerRestHapticFeedback() {
  try {
    if (Platform.OS === 'android') {
      // 3 pulsos fortes e marcantes no Android (500ms, pausa 200ms, 500ms, pausa 200ms, 600ms)
      Vibration.vibrate([0, 500, 200, 500, 200, 600], false);
    } else {
      // iOS: padrão array é ignorado. Vibrate() ativa a vibração física do motor de 400ms.
      Vibration.vibrate();
      setTimeout(() => {
        try { Vibration.vibrate(); } catch {}
      }, 550);
    }
  } catch {}

  try {
    // Alerta Taptic Engine (iOS)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }, 450);
  } catch {}
}

export const WorkoutSessionScreen: React.FC<WorkoutSessionScreenProps> = ({
  initialTitle,
  initialExercises = [],
  onFinish,
  onCancel,
}) => {
  const { colors, isDark } = useTheme();
  const { t, tExercise, tMuscle, unit, formatWeight } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'synced' | 'pending'>('idle');
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, isDark, insets);

  try { useKeepAwake(); } catch { /* ignore */ }

  const [workoutTitle, setWorkoutTitle] = useState(initialTitle || t('workoutSession.workoutName'));
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  const [exercises, setExercises] = useState<ActiveExerciseState[]>(() => {
    if (initialExercises.length > 0) {
      return initialExercises.map((e) => {
        const suggestion = COMMON_SUGGESTIONS.find(
          (s) => s.name.toLowerCase() === e.name.toLowerCase()
        );
        return {
          id: `${Date.now()}-${Math.random()}`,
          name: e.name,
          muscleGroup: e.muscleGroup || '',
          restTimerSeconds: e.restTimerSeconds || 90,
          mediaUrl: e.mediaUrl ?? suggestion?.mediaUrl,
          weightMode: isPerSideByDefault(e.name) ? 'per_side' : 'total',
          sets: [{ id: `${Date.now()}-1`, weight: '', reps: '', rpe: '', setType: 'normal', completed: false }],
        };
      });
    }
    const defaultSuggestion = COMMON_SUGGESTIONS.find((s) => s.name === 'Supino Reto com Barra');
    return [{
      id: `${Date.now()}-init`,
      name: 'Supino Reto com Barra',
      muscleGroup: 'Peito',
      restTimerSeconds: 90,
      mediaUrl: defaultSuggestion?.mediaUrl,
      weightMode: 'total',
      sets: [{ id: `${Date.now()}-set-1`, weight: '', reps: '', rpe: '', setType: 'normal', completed: false }],
    }];
  });

  // Cronômetro de sessão
  const sessionStartRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
    return () => { cancelRestNotification().catch(() => {}); };
  }, []);

  // Timer de descanso baseado em timestamps
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(90);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [isRestActive, setIsRestActive] = useState(false);
  const [restFinished, setRestFinished] = useState(false);
  const restStartTimestampRef = useRef<number | null>(null);
  const restDurationRef = useRef<number>(0);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRestActiveRef = useRef(false);
  const lastCountdownTickRef = useRef<number | null>(null);

  const syncRestTimer = useCallback(() => {
    if (!isRestActiveRef.current || restStartTimestampRef.current === null) return;
    const elapsed = Math.floor((Date.now() - restStartTimestampRef.current) / 1000);
    const remaining = Math.max(0, restDurationRef.current - elapsed);
    setRestSecondsLeft(remaining);

    // Contagem regressiva tátil nos últimos 3 segundos (3, 2, 1)
    if (remaining > 0 && remaining <= 3 && lastCountdownTickRef.current !== remaining) {
      lastCountdownTickRef.current = remaining;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }

    if (remaining <= 0) {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      lastCountdownTickRef.current = null;
      triggerRestHapticFeedback();
      cancelRestNotification().catch(() => {});
      isRestActiveRef.current = false;
      setIsRestActive(false);
      setRestFinished(true);
    }
  }, []);

  useEffect(() => {
    if (isRestActive) {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = setInterval(syncRestTimer, 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [isRestActive, syncRestTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') syncRestTimer();
    });
    return () => subscription.remove();
  }, [syncRestTimer]);

  const handleStartRestTimer = (exerciseName: string, durationSeconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    try { Vibration.cancel(); } catch {}
    const secs = durationSeconds > 0 ? durationSeconds : 90;
    restStartTimestampRef.current = Date.now();
    restDurationRef.current = secs;
    isRestActiveRef.current = true;
    lastCountdownTickRef.current = null;
    setRestFinished(false);
    setRestExerciseName(exerciseName);
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    setIsRestActive(true);
    // Reinicia o timer explicitamente para garantir o tick mesmo se isRestActive já era true
    restTimerRef.current = setInterval(syncRestTimer, 1000);
    scheduleRestNotification(exerciseName, secs).catch(() => {});
  };

  const handleAddRestSeconds = (delta: number) => {
    if (restStartTimestampRef.current === null) return;
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
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = setInterval(syncRestTimer, 1000);
      scheduleRestNotification(restExerciseName, newRemaining).catch(() => {});
    } else {
      cancelRestNotification().catch(() => {});
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      isRestActiveRef.current = false;
      setIsRestActive(false);
      setRestFinished(true);
    }
  };

  const handleSkipRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    try { Vibration.cancel(); } catch {}
    cancelRestNotification().catch(() => {});
    restStartTimestampRef.current = null;
    isRestActiveRef.current = false;
    setIsRestActive(false);
    setRestFinished(false);
    setRestSecondsLeft(0);
  };

  // Modal adicionar exercício
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('');

  const handleAddExerciseToList = (name: string, muscleGroup: string, mediaUrl?: string) => {
    const newEx: ActiveExerciseState = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      muscleGroup,
      restTimerSeconds: 90,
      mediaUrl,
      weightMode: isPerSideByDefault(name) ? 'per_side' : 'total',
      sets: [{ id: `${Date.now()}-set-1`, weight: '', reps: '', rpe: '', setType: 'normal', completed: false }],
    };
    setExercises((prev) => [...prev, newEx]);
    setIsAddModalVisible(false);
    setAddSearch('');
    setCustomExerciseName('');
    setCustomMuscleGroup('');
    // Navega para o exercício recém-adicionado
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
      setCurrentExerciseIndex(exercises.length);
    }, 200);
  };

  // Finalização
  const [isSaving, setIsSaving] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<{
    title: string;
    duration: string;
    totalVolume: number;
    totalSets: number;
    brokenPRs: Array<{ exerciseName: string; weight: number; reps: number }>;
    exerciseNames: string[];
  } | null>(null);

  const handleFinishWorkout = async () => {
    const validExercises: CreateExerciseInput[] = [];
    let totalVolumeKg = 0;
    let completedSetsCount = 0;
    const brokenPRs: Array<{ exerciseName: string; weight: number; reps: number }> = [];

    for (const ex of exercises) {
      const isPerSide = ex.weightMode === 'per_side';
      const validSets: CreateSetInput[] = [];
      let exMaxWeight = 0;
      let exMaxRepsAtMaxWeight = 0;

      for (const s of ex.sets) {
        const rawWeight = parseFloat(s.weight.replace(',', '.'));
        const reps = parseInt(s.reps, 10);
        if (!isNaN(rawWeight) && rawWeight >= 0 && !isNaN(reps) && reps > 0) {
          const weight = isPerSide ? Math.round(rawWeight * 2 * 100) / 100 : rawWeight;
          let rpe: number | null = null;
          if (s.rpe && s.rpe.trim().length > 0) {
            const parsedRpe = parseFloat(s.rpe.replace(',', '.'));
            if (!isNaN(parsedRpe)) rpe = parsedRpe;
          }
          validSets.push({
            weight,
            reps,
            rpe: rpe ?? null,
            set_type: s.setType?.trim() || 'normal',
            completed_at: s.completedAt?.trim() || new Date().toISOString(),
          });
          totalVolumeKg += weight * reps;
          completedSetsCount++;

          if (weight > exMaxWeight) {
            exMaxWeight = weight;
            exMaxRepsAtMaxWeight = reps;
          } else if (weight === exMaxWeight && reps > exMaxRepsAtMaxWeight) {
            exMaxRepsAtMaxWeight = reps;
          }
        }
      }
      if (validSets.length > 0) {
        validExercises.push({
          name: ex.name?.trim() || 'Exercício',
          muscle_group: ex.muscleGroup?.trim() || null,
          rest_timer_seconds: typeof ex.restTimerSeconds === 'number' ? ex.restTimerSeconds : 90,
          sets: validSets,
        });

        // Checar se bateu PR em relação ao treino anterior deste exercício
        try {
          const prev = await getLastWorkoutSetsForExercise(ex.name);
          if (prev && prev.length > 0) {
            let prevMaxW = 0;
            let prevMaxR = 0;
            for (const ps of prev) {
              if (ps.weight > prevMaxW) {
                prevMaxW = ps.weight;
                prevMaxR = ps.reps;
              } else if (ps.weight === prevMaxW && ps.reps > prevMaxR) {
                prevMaxR = ps.reps;
              }
            }
            if (exMaxWeight > prevMaxW || (exMaxWeight === prevMaxW && exMaxRepsAtMaxWeight > prevMaxR)) {
              brokenPRs.push({
                exerciseName: ex.name,
                weight: exMaxWeight,
                reps: exMaxRepsAtMaxWeight,
              });
            }
          }
        } catch { /* ignore */ }
      }
    }

    if (validExercises.length === 0) {
      Alert.alert(t('workoutSession.emptyWorkoutTitle'), t('workoutSession.emptyWorkoutMsg'));
      return;
    }

    setIsSaving(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const workoutInput: CreateWorkoutInput = {
        title: workoutTitle?.trim() || t('workoutSession.workoutFinished'),
        date: todayIso,
        notes: workoutNotes?.trim() || null,
        exercises: validExercises,
      };
      const createdWorkout = await createWorkout(workoutInput);
      try {
        await upsertDailyHabits({ date: todayIso, workout_done: 1 });
      } catch (habitErr) {
        console.warn('Treino salvo, mas falhou ao atualizar hábito diário:', habitErr);
      }

      // Backup automático na nuvem (PRO) — em background, nunca bloqueia o resumo do treino.
      if (isPro && user?.uid) {
        setCloudStatus('syncing');
        autoSyncAfterWorkout({ userId: user.uid, isPro, workout: createdWorkout })
          .then((status) => setCloudStatus(status === 'synced' ? 'synced' : status === 'pending' ? 'pending' : 'idle'))
          .catch(() => setCloudStatus('pending'));
      } else {
        setCloudStatus('idle');
      }
      setWorkoutSummary({
        title: workoutInput.title,
        duration: formatDuration(elapsedSeconds),
        totalVolume: Math.round(totalVolumeKg),
        totalSets: completedSetsCount,
        brokenPRs,
        exerciseNames: validExercises.map((e) => e.name),
      });
      setSummaryModalVisible(true);
    } catch (error) {
      console.error('Erro ao salvar o treino:', error);
      Alert.alert(t('common.error'), t('workoutSession.saveWorkoutError'));
    } finally {
      setIsSaving(false);
    }
  };

  const restBarVisible = isRestActive || restSecondsLeft > 0 || restFinished;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [restBarVisible]);

  const NAV_BAR_HEIGHT = 56;
  const bottomBarInset = Math.max(insets.bottom, 12);
  const totalNavHeight = NAV_BAR_HEIGHT + bottomBarInset;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* ─── TOP BAR ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            Alert.alert(
              t('workoutSession.cancelWorkout'),
              t('workoutSession.cancelConfirmMsg'),
              [
                { text: t('workoutSession.continueWorkout'), style: 'cancel' },
                { text: t('workoutSession.discardWorkout'), style: 'destructive', onPress: onCancel },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Centro: Cronômetro */}
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
          <Text style={styles.addExerciseTopBtnText}>{t('workoutSession.addExerciseTop')}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── TÍTULO DO TREINO ─── */}
      <View style={styles.titleCard}>
        <TextInput
          style={styles.workoutTitleInput}
          value={workoutTitle}
          onChangeText={setWorkoutTitle}
          placeholder={t('workoutSession.workoutName')}
          placeholderTextColor={colors.textMuted}
        />
        {/* Indicador de exercício + dots de navegação */}
        {exercises.length > 0 && (
          <View style={styles.navDotsRow}>
            <Text style={styles.exerciseCounter}>
              {currentExerciseIndex + 1}/{exercises.length}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsScroll}>
              {exercises.map((ex, i) => {
                const allDone = ex.sets.length > 0 && ex.sets.every(s => s.completed);
                const someDone = ex.sets.some(s => s.completed);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => {
                      flatListRef.current?.scrollToIndex({ index: i, animated: true });
                      setCurrentExerciseIndex(i);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dot,
                      i === currentExerciseIndex && styles.dotActive,
                      allDone && styles.dotDone,
                      someDone && !allDone && styles.dotPartial,
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ─── LISTA DE EXERCÍCIOS (horizontal paginada) ─── */}
      <FlatList
        ref={flatListRef}
        data={exercises}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (newIndex !== currentExerciseIndex) setCurrentExerciseIndex(newIndex);
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item: exercise, index }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: totalNavHeight + (restBarVisible ? 95 : 20) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ExerciseBlock
                exercise={exercise}
                index={index}
                onUpdateExercise={(updated) => {
                  setExercises((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
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
            </ScrollView>
          </View>
        )}
      />

      {/* ─── BARRA FIXA DE NAVEGAÇÃO INFERIOR ─── */}
      <View style={[styles.navBar, { height: totalNavHeight, paddingBottom: bottomBarInset }]}>
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
          <Text style={[styles.navBtnText, currentExerciseIndex === 0 && styles.navBtnTextDisabled]}>←</Text>
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navExerciseName} numberOfLines={1}>
            {exercises[currentExerciseIndex] ? tExercise(exercises[currentExerciseIndex].name) : ''}
          </Text>
          <Text style={styles.navCounter}>{currentExerciseIndex + 1} / {exercises.length}</Text>
        </View>

        {currentExerciseIndex === exercises.length - 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.finishNavBtn]}
            onPress={handleFinishWorkout}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.finishNavBtnText}>🏁</Text>
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
            <Text style={styles.nextNavBtnText}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── BARRA DE DESCANSO FLUTUANTE (Dynamic Island Capsule) ─── */}
      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotalSeconds}
        exerciseName={restExerciseName ? tExercise(restExerciseName) : ''}
        isActive={isRestActive}
        isFinished={restFinished}
        onAddSeconds={handleAddRestSeconds}
        onSkip={handleSkipRest}
        bottomOffset={totalNavHeight + 10}
      />

      {/* ─── MODAL ADICIONAR EXERCÍCIO ─── */}
      <Modal visible={isAddModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.addModalContainer, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.addModalHandle} />
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>{t('workoutSession.addExercise')}</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.addModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Busca com autocomplete */}
            <ExerciseSearchInput
              value={addSearch}
              onChangeText={setAddSearch}
              placeholder={t('workoutSession.searchExercisePlaceholder')}
              onSelectExercise={(name, group, mediaUrl) => handleAddExerciseToList(name, group, mediaUrl)}
            />

            {/* Divider */}
            <View style={styles.addModalDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('workoutSession.orCustom')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Input customizado */}
            <TextInput
              style={styles.customInput}
              placeholder={t('workoutSession.customExerciseName')}
              placeholderTextColor={colors.textMuted}
              value={customExerciseName}
              onChangeText={setCustomExerciseName}
            />
            <TextInput
              style={[styles.customInput, { marginTop: 8 }]}
              placeholder={t('workoutSession.customMuscleGroup')}
              placeholderTextColor={colors.textMuted}
              value={customMuscleGroup}
              onChangeText={setCustomMuscleGroup}
            />
            <TouchableOpacity
              style={[styles.confirmAddBtn, !customExerciseName.trim() && styles.confirmAddBtnDisabled]}
              disabled={!customExerciseName.trim()}
              onPress={() => handleAddExerciseToList(customExerciseName.trim(), customMuscleGroup.trim(), undefined)}
            >
              <Text style={styles.confirmAddBtnText}>{t('workoutSession.addCustomBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RESUMO ─── */}
      <Modal visible={summaryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.summaryCard}>
            <View style={styles.trophyCircle}>
              <Text style={styles.trophyIcon}>🏆</Text>
            </View>
            <Text style={styles.summaryTitle}>{t('workoutSession.workoutFinished')}</Text>
            <Text style={styles.summarySubtitle}>
              {t('workoutSession.workoutFinishedSub')}
            </Text>

            {workoutSummary && (
              <View style={styles.summaryMetricsGrid}>
                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>{t('workoutSession.timeLabel')}</Text>
                  <Text style={styles.summaryMetricValue}>{workoutSummary.duration}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>{t('workoutSession.setsLabel')}</Text>
                  <Text style={styles.summaryMetricValue}>{workoutSummary.totalSets}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryMetricCol}>
                  <Text style={styles.summaryMetricLabel}>{t('workoutSession.volumeLabel')}</Text>
                  <Text style={[styles.summaryMetricValue, { color: colors.primary }]}>
                    {formatWeight(workoutSummary.totalVolume)}
                  </Text>
                </View>
              </View>
            )}

            {/* Vitrine de Novos Recordes Pessoais */}
            {workoutSummary && workoutSummary.brokenPRs && workoutSummary.brokenPRs.length > 0 && (
              <View style={styles.prSummaryCard}>
                <View style={styles.prSummaryHeaderRow}>
                  <Text style={styles.prSummaryBadgeIcon}>🔥</Text>
                  <Text style={styles.prSummaryTitle}>
                    {t('workoutSession.newPrsToday', {
                      count: workoutSummary.brokenPRs.length,
                      pluralS: workoutSummary.brokenPRs.length > 1 ? 'S' : '',
                    })}
                  </Text>
                </View>
                {workoutSummary.brokenPRs.map((pr, idx) => (
                  <View key={idx} style={styles.prSummaryItem}>
                    <Text style={styles.prSummaryItemName} numberOfLines={1}>
                      {tExercise(pr.exerciseName)}
                    </Text>
                    <Text style={styles.prSummaryItemValue}>
                      {formatWeight(pr.weight)} × {pr.reps} {t('common.reps')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {cloudStatus !== 'idle' && (
              <View style={styles.cloudStatusRow}>
                {cloudStatus === 'syncing' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
                <Text
                  style={[
                    styles.cloudStatusText,
                    cloudStatus === 'synced' && { color: colors.success },
                    cloudStatus === 'pending' && { color: colors.streak },
                  ]}
                >
                  {cloudStatus === 'syncing'
                    ? 'Enviando para a nuvem...'
                    : cloudStatus === 'synced'
                    ? '☁️ Treino salvo na nuvem'
                    : '☁️ Sem conexão — vamos enviar assim que possível'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.shareSummaryBtn}
              onPress={() => setShareModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.shareSummaryBtnText}>📤 Compartilhar Treino / Story</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishDialogBtn}
              onPress={() => { setSummaryModalVisible(false); onFinish?.(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.finishDialogBtnText}>{t('workoutSession.backToHome')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <WorkoutShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        data={workoutSummary}
      />
    </View>
  );
};

function makeStyles(colors: any, isDark: boolean, insets: { top: number; bottom: number; left: number; right: number }) {
  return StyleSheet.create({
    root: {
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
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.3)',
      backgroundColor: 'rgba(239,68,68,0.07)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelButtonText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
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
    elapsedIcon: { fontSize: 13 },
    elapsedText: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
    addExerciseTopBtn: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    addExerciseTopBtnText: { fontSize: 13, fontWeight: '800', color: colors.primary },

    // ── Title Card ──
    titleCard: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    workoutTitleInput: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      paddingVertical: 2,
    },
    navDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 10,
    },
    exerciseCounter: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      minWidth: 36,
    },
    dotsScroll: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingRight: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceBorder },
    dotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    dotDone: { backgroundColor: colors.success },
    dotPartial: { backgroundColor: colors.streak },

    // ── Content ──
    scrollContent: { paddingHorizontal: 14, paddingTop: 14 },

    // ── Barra de navegação fixa (bottom) ──
    navBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      zIndex: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 10,
    },
    navBtn: {
      width: 44,
      height: 44,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navBtnDisabled: { opacity: 0.28 },
    navBtnText: { color: colors.textSecondary, fontSize: 20, fontWeight: '700' },
    navBtnTextDisabled: { color: colors.textMuted },
    navCenter: { flex: 1, alignItems: 'center' },
    navExerciseName: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    navCounter: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 1,
    },
    nextNavBtn: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    nextNavBtnText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
    finishNavBtn: { backgroundColor: colors.success, borderColor: colors.success, borderWidth: 1.5 },
    finishNavBtnText: { color: colors.onPrimary, fontSize: 18, fontWeight: '900' },

    // ── Modals ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    addModalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 20,
      maxHeight: '90%',
    },
    addModalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceBorder,
      alignSelf: 'center',
      marginBottom: 16,
    },
    addModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    addModalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    addModalClose: { color: colors.textMuted, fontSize: 20, fontWeight: '700', padding: 4 },
    addModalDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 16,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.surfaceBorder },
    dividerText: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },

    customInput: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      fontSize: 14,
    },
    confirmAddBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 12,
    },
    confirmAddBtnDisabled: { opacity: 0.45 },
    confirmAddBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },

    // ── Summary ──
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.success,
      margin: 24,
      padding: 24,
      alignItems: 'center',
    },
    trophyCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(16,185,129,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.success,
    },
    trophyIcon: { fontSize: 36 },
    summaryTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 },
    summarySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
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
    summaryMetricCol: { alignItems: 'center', flex: 1 },
    summaryDivider: { width: 1, height: 30, backgroundColor: colors.surfaceBorder },
    summaryMetricLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 },
    summaryMetricValue: { fontSize: 16, fontWeight: '900', color: colors.textPrimary },

    // ── PR Summary Box ──
    prSummaryCard: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
      borderWidth: 1.5,
      borderColor: '#F59E0B',
      borderRadius: 14,
      padding: 12,
      marginBottom: 20,
      gap: 8,
    },
    prSummaryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    prSummaryBadgeIcon: { fontSize: 16 },
    prSummaryTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: '#F59E0B',
      letterSpacing: 0.5,
    },
    prSummaryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    prSummaryItemName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    prSummaryItemValue: {
      fontSize: 12,
      fontWeight: '900',
      color: '#F59E0B',
    },

    shareSummaryBtn: {
      backgroundColor: colors.primary,
      width: '100%',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginBottom: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    shareSummaryBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    cloudStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 12,
    },
    cloudStatusText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    finishDialogBtn: { backgroundColor: colors.surfaceElevated, width: '100%', paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
    finishDialogBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  });
}

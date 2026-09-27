import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';
import { calculate1RMBrzycki } from '../utils/oneRepMax';
import { getLastWorkoutSetsForExercise, type WorkoutSet } from '../database/db';
import { ExerciseSearchInput } from './ExerciseSearchInput';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface ActiveSetState {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
  setType: SetType;
  completed: boolean;
  completedAt?: string;
}

export interface ActiveExerciseState {
  id: string;
  name: string;
  muscleGroup: string;
  restTimerSeconds: number;
  sets: ActiveSetState[];
  mediaUrl?: string;
  weightMode?: 'total' | 'per_side';
}

export interface ExerciseBlockProps {
  exercise: ActiveExerciseState;
  index: number;
  onUpdateExercise: (updated: ActiveExerciseState) => void;
  onRemoveExercise: (id: string) => void;
  onSetCompleted: (exerciseName: string, restTimerSeconds: number) => void;
}

const REST_TIME_OPTIONS = [30, 60, 90, 120, 180, 300];

function formatRestTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

const SET_TYPE_CONFIG: Record<SetType, { label: string; short: string; color: string }> = {
  normal:  { label: 'Normal',        short: 'N', color: '#38BDF8' },
  warmup:  { label: 'Aquecimento',   short: 'A', color: '#F59E0B' },
  drop:    { label: 'Drop-set',      short: 'D', color: '#A855F7' },
  failure: { label: 'Até a Falha',   short: 'F', color: '#EF4444' },
};

// ─── Componente principal ──────────────────────────────────────────────────────

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({
  exercise,
  index,
  onUpdateExercise,
  onRemoveExercise,
  onSetCompleted,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const [detailsSet, setDetailsSet] = useState<ActiveSetState | null>(null);
  const [previousSets, setPreviousSets] = useState<WorkoutSet[] | null>(null);
  const [isReplaceModalVisible, setIsReplaceModalVisible] = useState(false);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [isMediaModalVisible, setIsMediaModalVisible] = useState(false);
  const [showRestChips, setShowRestChips] = useState(false);

  // Modo de peso: 'total' ou 'per_side' (por lado/unilateral)
  const weightMode = exercise.weightMode || 'total';
  const isPerSide = weightMode === 'per_side';

  // Série atualmente selecionada para ações rápidas
  const [activeSetId, setActiveSetId] = useState<string | null>(() => {
    const firstUncompleted = exercise.sets.find(s => !s.completed);
    return firstUncompleted ? firstUncompleted.id : (exercise.sets[0]?.id || null);
  });

  // Mantém activeSetId sincronizado se séries mudarem
  React.useEffect(() => {
    if (!activeSetId || !exercise.sets.some(s => s.id === activeSetId)) {
      const firstUncompleted = exercise.sets.find(s => !s.completed);
      setActiveSetId(firstUncompleted ? firstUncompleted.id : (exercise.sets[0]?.id || null));
    }
  }, [exercise.sets, activeSetId]);

  React.useEffect(() => {
    let isMounted = true;
    getLastWorkoutSetsForExercise(exercise.name).then((sets) => {
      if (isMounted && sets) setPreviousSets(sets);
    });
    return () => { isMounted = false; };
  }, [exercise.name]);

  const handleChangeWeightMode = (newMode: 'total' | 'per_side') => {
    if (weightMode === newMode) return;
    const updatedSets = exercise.sets.map((s) => {
      const w = parseFloat(s.weight.replace(',', '.'));
      if (!isNaN(w) && w > 0) {
        const converted = newMode === 'per_side' ? w / 2 : w * 2;
        return { ...s, weight: String(Math.round(converted * 100) / 100) };
      }
      return s;
    });
    onUpdateExercise({ ...exercise, weightMode: newMode, sets: updatedSets });
  };

  const handleQuickAddWeight = (setId: string, increment: number) => {
    const targetSet = exercise.sets.find(s => s.id === setId);
    if (!targetSet) return;

    const currentVal = parseFloat(targetSet.weight.replace(',', '.')) || 0;
    const nextVal = Math.max(0, Math.round((currentVal + increment) * 100) / 100);

    // Auto-sugestão de reps se estiver vazio
    let nextReps = targetSet.reps;
    if (!nextReps || nextReps === '') {
      const setIdx = exercise.sets.findIndex(s => s.id === setId);
      const prevSet = previousSets ? previousSets[setIdx] : null;
      if (prevSet && prevSet.reps) {
        nextReps = String(prevSet.reps);
      } else if (setIdx > 0 && exercise.sets[setIdx - 1]?.reps) {
        nextReps = exercise.sets[setIdx - 1].reps;
      }
    }

    const updatedSets = exercise.sets.map(s =>
      s.id === setId ? { ...s, weight: nextVal > 0 ? String(nextVal) : '', reps: nextReps } : s
    );
    onUpdateExercise({ ...exercise, sets: updatedSets });
  };


  const handleRepeatPreviousWorkout = () => {
    if (!previousSets || previousSets.length === 0) return;

    const hasCompleted = exercise.sets.some(s => s.completed);

    if (!hasCompleted) {
      // Início do treino: preenche exatamente todas as séries do treino anterior
      const newSets: ActiveSetState[] = previousSets.map((ps, idx) => {
        const displayW = isPerSide ? Math.round((ps.weight / 2) * 100) / 100 : ps.weight;
        return {
          id: `${Date.now()}-${idx}-${Math.random()}`,
          weight: String(displayW),
          reps: String(ps.reps),
          rpe: '',
          setType: 'normal',
          completed: false,
        };
      });
      onUpdateExercise({ ...exercise, sets: newSets });
      if (newSets.length > 0) setActiveSetId(newSets[0].id);
    } else {
      // Já iniciou: preenche apenas as séries ainda não concluídas
      const updatedSets = exercise.sets.map((s, idx) => {
        if (s.completed) return s;
        const ps = previousSets[idx];
        if (!ps) return s;
        const displayW = isPerSide ? Math.round((ps.weight / 2) * 100) / 100 : ps.weight;
        return {
          ...s,
          weight: String(displayW),
          reps: String(ps.reps),
        };
      });
      onUpdateExercise({ ...exercise, sets: updatedSets });
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      try { Vibration.vibrate(100); } catch { /* ignore */ }
    }
  };

  const handleAddSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: ActiveSetState = {
      id: `${Date.now()}-${Math.random()}`,
      weight: lastSet ? lastSet.weight : '',
      reps: lastSet ? lastSet.reps : '',
      rpe: '',
      setType: 'normal',
      completed: false,
    };
    setActiveSetId(newSet.id);
    onUpdateExercise({ ...exercise, sets: [...exercise.sets, newSet] });
  };

  const handleRemoveSet = (setId: string) => {
    onUpdateExercise({ ...exercise, sets: exercise.sets.filter((s) => s.id !== setId) });
  };

  const handleUpdateSetField = (setId: string, field: keyof ActiveSetState, value: unknown) => {
    const updatedSets = exercise.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s);
    onUpdateExercise({ ...exercise, sets: updatedSets });
  };

  // Melhor performance histórica do treino anterior para Sobrecarga e PR
  let prevBestWeight = 0;
  let prevBestRepsAtBestW = 0;
  if (previousSets && previousSets.length > 0) {
    for (const ps of previousSets) {
      if (ps.weight > prevBestWeight) {
        prevBestWeight = ps.weight;
        prevBestRepsAtBestW = ps.reps;
      } else if (ps.weight === prevBestWeight && ps.reps > prevBestRepsAtBestW) {
        prevBestRepsAtBestW = ps.reps;
      }
    }
  }

  const handleToggleComplete = (set: ActiveSetState) => {
    const newCompleted = !set.completed;
    const nowIso = newCompleted ? new Date().toISOString() : undefined;
    let updatedSets = exercise.sets.map((s) =>
      s.id === set.id ? { ...s, completed: newCompleted, completedAt: nowIso } : s
    );

    // Auto-preenchimento inteligente: se o usuário completou e a próxima série estiver vazia, copia carga e reps
    if (newCompleted && set.weight && set.reps) {
      const currentIndex = exercise.sets.findIndex(s => s.id === set.id);
      if (currentIndex >= 0 && currentIndex < exercise.sets.length - 1) {
        const nextSet = exercise.sets[currentIndex + 1];
        if (!nextSet.completed && (!nextSet.weight || nextSet.weight === '') && (!nextSet.reps || nextSet.reps === '')) {
          updatedSets = updatedSets.map((s, idx) =>
            idx === currentIndex + 1 ? { ...s, weight: set.weight, reps: set.reps } : s
          );
        }
      }

      // Vibração de PR se bateu recorde
      const currInputW = parseFloat(set.weight.replace(',', '.'));
      const currReps = parseInt(set.reps, 10);
      const effectiveW = isPerSide ? currInputW * 2 : currInputW;
      if (
        prevBestWeight > 0 &&
        !isNaN(effectiveW) &&
        !isNaN(currReps) &&
        (effectiveW > prevBestWeight || (effectiveW === prevBestWeight && currReps > prevBestRepsAtBestW))
      ) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          try { Vibration.vibrate(250); } catch { /* ignore */ }
        }
      }
    }

    onUpdateExercise({ ...exercise, sets: updatedSets });
    if (newCompleted) onSetCompleted(exercise.name, exercise.restTimerSeconds || 90);
  };

  const handleCycleSetType = (set: ActiveSetState) => {
    const types: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
    const nextType = types[(types.indexOf(set.setType) + 1) % types.length];
    handleUpdateSetField(set.id, 'setType', nextType);
  };

  const handleChangeRestTimer = (seconds: number) => {
    onUpdateExercise({ ...exercise, restTimerSeconds: seconds });
  };

  const handleFillFromPrevious = (setId: string, fillWeight: number, fillReps: number) => {
    const updatedSets = exercise.sets.map(s =>
      s.id === setId ? { ...s, weight: String(Math.round(fillWeight * 100) / 100), reps: String(fillReps) } : s
    );
    onUpdateExercise({ ...exercise, sets: updatedSets });
  };

  // 1RM estimado (sempre contabiliza a carga total real)
  let best1RM = 0;
  for (const s of exercise.sets) {
    const w = parseFloat(s.weight.replace(',', '.'));
    const r = parseInt(s.reps, 10);
    const effectiveW = isPerSide ? w * 2 : w;
    if (!isNaN(effectiveW) && effectiveW > 0 && !isNaN(r) && r > 0 && r < 37) {
      try { const est = calculate1RMBrzycki(effectiveW, r); if (est > best1RM) best1RM = est; } catch { /* ignore */ }
    }
  }

  // Progresso das séries
  const completedCount = exercise.sets.filter(s => s.completed).length;
  const totalSets = exercise.sets.length;

  return (
    <View style={styles.blockContainer}>

      {/* ── Cabeçalho ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleInfo}>
          {exercise.mediaUrl ? (
            <TouchableOpacity onPress={() => setIsMediaModalVisible(true)} activeOpacity={0.8}>
              <Image source={{ uri: exercise.mediaUrl }} style={styles.headerThumbnail} contentFit="cover" cachePolicy="disk" transition={150} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerThumbnailFallback}>
              <Text style={styles.headerThumbnailFallbackIcon}>💪</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
            {exercise.muscleGroup ? (
              <Text style={styles.muscleGroupTag}>{exercise.muscleGroup}</Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={styles.exerciseIndex}>#{index + 1}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsReplaceModalVisible(true)} activeOpacity={0.7}>
            <Text style={styles.iconBtnText}>↔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnDanger} onPress={() => onRemoveExercise(exercise.id)} activeOpacity={0.7}>
            <Text style={styles.iconBtnDangerText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Progress + Descanso ── */}
      <View style={styles.metaRow}>
        {/* Progresso de séries */}
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>
            {completedCount}/{totalSets} séries
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: totalSets > 0 ? `${(completedCount / totalSets) * 100}%` : '0%' as any }]} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {best1RM > 0 && (
            <View style={styles.oneRmBadge}>
              <Text style={styles.oneRmLabel}>1RM ESTIMADO</Text>
              <Text style={styles.oneRmValue}>{best1RM.toFixed(1)} kg</Text>
            </View>
          )}
          {/* Descanso */}
          <TouchableOpacity
            onPress={() => setShowRestChips(v => !v)}
            style={styles.restToggleChip}
            activeOpacity={0.7}
          >
            <Text style={styles.restToggleChipText}>⏱ {formatRestTime(exercise.restTimerSeconds)} {showRestChips ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chips de descanso expandidos */}
      {showRestChips && (
        <View style={styles.restOptionsRow}>
          {REST_TIME_OPTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[styles.restChip, exercise.restTimerSeconds === sec && styles.restChipActive]}
              onPress={() => { handleChangeRestTimer(sec); setShowRestChips(false); }}
            >
              <Text style={[styles.restChipText, exercise.restTimerSeconds === sec && styles.restChipTextActive]}>
                {formatRestTime(sec)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Card de Evolução & Meta (Minimalista e Prático) ── */}
      {prevBestWeight > 0 && (
        <View style={styles.evolutionCard}>
          <View style={styles.evolutionRow}>
            {/* Coluna 1: Desempenho Anterior */}
            <View style={styles.evolutionCol}>
              <Text style={styles.evolutionLabel}>ÚLTIMO TREINO</Text>
              <Text style={styles.evolutionValue}>
                {isPerSide ? `${prevBestWeight / 2} kg/lado` : `${prevBestWeight} kg`}
                <Text style={styles.evolutionReps}> × {prevBestRepsAtBestW} reps</Text>
              </Text>
            </View>

            <View style={styles.evolutionDivider} />

            {/* Coluna 2: Meta Clara para Superar */}
            <View style={styles.evolutionCol}>
              <Text style={styles.evolutionMetaLabel}>🎯 META HOJE</Text>
              <Text style={styles.evolutionMetaValue}>
                +{isPerSide ? '1.25' : '2.5'} kg <Text style={styles.evolutionOr}>ou</Text> +1 rep
              </Text>
            </View>
          </View>

          {/* Botão de Repetir Séries do Treino Anterior em 1 Toque */}
          {previousSets && previousSets.length > 0 && (
            <TouchableOpacity
              style={styles.repeatAllBtn}
              onPress={handleRepeatPreviousWorkout}
              activeOpacity={0.75}
            >
              <Text style={styles.repeatAllBtnIcon}>⚡</Text>
              <Text style={styles.repeatAllBtnText}>
                Repetir {previousSets.length} {previousSets.length === 1 ? 'série do último treino' : 'séries do último treino'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Seletor de Modo de Peso (Total vs Por Lado) ── */}
      <View style={styles.weightModeSelector}>
        <TouchableOpacity
          style={[styles.weightModeTab, !isPerSide && styles.weightModeTabActive]}
          onPress={() => handleChangeWeightMode('total')}
          activeOpacity={0.8}
        >
          <Text style={[styles.weightModeText, !isPerSide && styles.weightModeTextActive]}>
            🏋️ Carga Total
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.weightModeTab, isPerSide && styles.weightModeTabActive]}
          onPress={() => handleChangeWeightMode('per_side')}
          activeOpacity={0.8}
        >
          <Text style={[styles.weightModeText, isPerSide && styles.weightModeTextActive]}>
            ⚖️ Carga por Lado
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Séries ── */}
      <View style={styles.setsSection}>
        {/* Cabeçalho da tabela */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colHeader, { width: 36 }]}>SET</Text>
          <Text style={[styles.colHeader, { flex: 1 }]}>
            {isPerSide ? 'CADA LADO' : 'PESO (KG)'}
          </Text>
          <Text style={[styles.colHeader, { width: 60 }]}>REPS</Text>
          <Text style={[styles.colHeader, { width: 76 }]}>FEITO</Text>
        </View>

        {exercise.sets.map((set, setIndex) => {
          const prevSet = previousSets ? previousSets[setIndex] : null;
          const typeConfig = SET_TYPE_CONFIG[set.setType];

          // Valores do treino anterior
          const prevTotalW = prevSet ? prevSet.weight : null;
          const prevR = prevSet ? prevSet.reps : null;
          const prevDisplayW = prevTotalW !== null ? (isPerSide ? Math.round((prevTotalW / 2) * 100) / 100 : prevTotalW) : null;

          // Valores da série atual
          const currInputW = parseFloat(set.weight.replace(',', '.'));
          const currR = parseInt(set.reps, 10);
          const currEffectiveW = isPerSide ? currInputW * 2 : currInputW;

          // Cálculo do Total para o modo Por Lado
          const displayTotalKg = isPerSide && !isNaN(currInputW) && currInputW > 0 ? Math.round(currInputW * 2 * 100) / 100 : 0;

          // Se esta série é a ativa selecionada para botões rápidos
          const isActive = activeSetId === set.id || (!activeSetId && !set.completed && exercise.sets.findIndex(s => !s.completed) === setIndex);

          // Detecção de PR (Recorde Pessoal)
          const isPR = set.completed && prevBestWeight > 0 && !isNaN(currEffectiveW) && !isNaN(currR) &&
            (currEffectiveW > prevBestWeight || (currEffectiveW === prevBestWeight && currR > prevBestRepsAtBestW));

          // Comparação com a mesma série do treino anterior
          const hasComparison = prevTotalW !== null && set.completed && !isNaN(currEffectiveW) && !isNaN(currR);
          const weightDelta = hasComparison ? currEffectiveW - prevTotalW! : 0;
          const repsDelta = hasComparison ? currR - prevR! : 0;

          const getDeltaStyle = (delta: number) => {
            if (delta > 0) return { symbol: '↑', color: colors.success };
            if (delta < 0) return { symbol: '↓', color: colors.danger };
            return { symbol: '=', color: colors.textMuted };
          };
          const wDelta = getDeltaStyle(weightDelta);

          return (
            <View key={set.id} style={styles.setGroup}>
              {/* Linha principal da série */}
              <View style={[styles.setRow, set.completed && styles.setRowCompleted, isActive && !set.completed && styles.setRowActive]}>
                {/* Tipo/Número */}
                <TouchableOpacity
                  onPress={() => {
                    setActiveSetId(set.id);
                    handleCycleSetType(set);
                  }}
                  style={[styles.setBadge, { borderColor: typeConfig.color }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.setNumber, { color: typeConfig.color }]}>{setIndex + 1}</Text>
                  {set.setType !== 'normal' && (
                    <Text style={[styles.setTypeTag, { color: typeConfig.color }]}>{typeConfig.short}</Text>
                  )}
                </TouchableOpacity>

                {/* Peso (Total ou Por Lado) */}
                <View style={styles.weightCell}>
                  <TextInput
                    style={[
                      styles.numericInput,
                      set.completed && styles.inputCompleted,
                      isActive && !set.completed && styles.numericInputActive,
                    ]}
                    placeholder={prevDisplayW !== null ? String(prevDisplayW) : '0'}
                    placeholderTextColor={prevDisplayW !== null ? colors.primary + '55' : colors.textMuted}
                    keyboardType="decimal-pad"
                    value={set.weight}
                    onFocus={() => setActiveSetId(set.id)}
                    onChangeText={(val) => handleUpdateSetField(set.id, 'weight', val)}
                    editable={!set.completed}
                  />
                  {isPerSide && displayTotalKg > 0 && (
                    <Text style={styles.totalSubText} numberOfLines={1}>
                      Tot: {displayTotalKg}kg
                    </Text>
                  )}
                </View>

                {/* Reps */}
                <View style={{ width: 60, paddingHorizontal: 2 }}>
                  <TextInput
                    style={[styles.numericInput, set.completed && styles.inputCompleted]}
                    placeholder={prevR !== null ? String(prevR) : '0'}
                    placeholderTextColor={prevR !== null ? colors.primary + '55' : colors.textMuted}
                    keyboardType="decimal-pad"
                    value={set.reps}
                    onFocus={() => setActiveSetId(set.id)}
                    onChangeText={(val) => handleUpdateSetField(set.id, 'reps', val)}
                    editable={!set.completed}
                  />
                </View>

                {/* Botão FEITO */}
                <TouchableOpacity
                  style={[styles.completeBtn, set.completed && styles.completeBtnDone]}
                  onPress={() => handleToggleComplete(set)}
                  activeOpacity={0.8}
                >
                  {set.completed ? (
                    <Text style={styles.completeBtnTextDone}>✓ OK</Text>
                  ) : (
                    <Text style={styles.completeBtnText}>FEITO</Text>
                  )}
                </TouchableOpacity>

                {/* Excluir */}
                <TouchableOpacity
                  onPress={() => handleRemoveSet(set.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={styles.deleteSetBtn}
                >
                  <Text style={styles.deleteSetIcon}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Barra de Ajuste Rápido de Carga (+2.5kg, +5kg, +10kg, +20kg) APENAS na série ativa não-concluída */}
              {isActive && !set.completed && (
                <View style={styles.quickBar}>
                  <View style={styles.quickBarRow}>
                    <TouchableOpacity
                      style={styles.quickBtn}
                      onPress={() => handleQuickAddWeight(set.id, 2.5)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickBtnText}>+2.5 kg</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickBtn}
                      onPress={() => handleQuickAddWeight(set.id, 5)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickBtnText}>+5 kg</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickBtn}
                      onPress={() => handleQuickAddWeight(set.id, 10)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickBtnText}>+10 kg</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.quickBtn, styles.quickBtnHeavy]}
                      onPress={() => handleQuickAddWeight(set.id, 20)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickBtnHeavyText}>+20 kg</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Badge discreta pós-conclusão: PR ou Comparação */}
              {set.completed && isPR ? (
                <View style={styles.prBadge}>
                  <Text style={styles.prBadgeIcon}>🏆</Text>
                  <Text style={styles.prBadgeText}>NOVO RECORDE!</Text>
                  <Text style={styles.prBadgeSub}>
                    {currEffectiveW > prevBestWeight ? `+${(currEffectiveW - prevBestWeight).toFixed(1)}kg` : `+${currR - prevBestRepsAtBestW} reps`}
                  </Text>
                </View>
              ) : set.completed && hasComparison && (weightDelta !== 0 || repsDelta !== 0) ? (
                <View style={styles.deltaBadge}>
                  <Text style={[styles.deltaSymbol, { color: wDelta.color }]}>{wDelta.symbol}</Text>
                  <Text style={[styles.deltaText, { color: wDelta.color }]}>
                    {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                  </Text>
                  {repsDelta !== 0 && (
                    <Text style={styles.deltaReps}>
                      {repsDelta > 0 ? ' +' : ' '}{repsDelta} reps
                    </Text>
                  )}
                  <Text style={styles.deltaVs}> vs anterior</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Botão Adicionar Série */}
      <TouchableOpacity style={styles.addSetButton} onPress={handleAddSet} activeOpacity={0.8}>
        <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
      </TouchableOpacity>

      {/* ── Modal Detalhes (RPE + Tipo) — acessível pelo toque longo no badge ── */}
      <Modal visible={detailsSet !== null} transparent animationType="fade" onRequestClose={() => setDetailsSet(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.detailsModalTitle}>Configurações da Série</Text>
              <TouchableOpacity onPress={() => setDetailsSet(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailsSet ? (
              <>
                <Text style={styles.modalSectionLabel}>ESFORÇO PERCEBIDO (RPE)</Text>
                <View style={styles.rpeChipsGrid}>
                  {[
                    { val: '10', label: 'Falha' }, { val: '9.5', label: '½ rep' }, { val: '9', label: '1 rep' },
                    { val: '8.5', label: '1½ rep' }, { val: '8', label: '2 reps' }, { val: '7.5', label: '2½' },
                    { val: '7', label: '3 reps' }, { val: '6', label: '4+ reps' },
                  ].map(({ val, label }) => {
                    const isSel = detailsSet.rpe === val;
                    return (
                      <TouchableOpacity key={val}
                        style={[styles.rpeChip, isSel && styles.rpeChipSelected]}
                        onPress={() => { handleUpdateSetField(detailsSet.id, 'rpe', val); setDetailsSet(p => p ? { ...p, rpe: val } : null); }}
                      >
                        <Text style={[styles.rpeChipValue, isSel && styles.rpeChipValueSel]}>{val}</Text>
                        <Text style={[styles.rpeChipLabel, isSel && styles.rpeChipLabelSel]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={styles.rpeChipClear}
                    onPress={() => { handleUpdateSetField(detailsSet.id, 'rpe', ''); setDetailsSet(p => p ? { ...p, rpe: '' } : null); }}>
                    <Text style={styles.rpeChipClearText}>Limpar</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>TIPO DE SÉRIE</Text>
                <View style={styles.setTypeRow}>
                  {(['normal', 'warmup', 'drop', 'failure'] as SetType[]).map(t => {
                    const isSel = detailsSet.setType === t;
                    return (
                      <TouchableOpacity key={t}
                        style={[styles.setTypeChip, isSel && { backgroundColor: SET_TYPE_CONFIG[t].color, borderColor: SET_TYPE_CONFIG[t].color }]}
                        onPress={() => { handleUpdateSetField(detailsSet.id, 'setType', t); setDetailsSet(p => p ? { ...p, setType: t } : null); }}
                      >
                        <Text style={[styles.setTypeChipText, isSel && styles.setTypeChipTextSel]}>{SET_TYPE_CONFIG[t].label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.doneBtn} onPress={() => setDetailsSet(null)} activeOpacity={0.85}>
                  <Text style={styles.doneBtnText}>Pronto</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Modal Substituir ── */}
      <Modal visible={isReplaceModalVisible} transparent animationType="slide"
        onRequestClose={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }}>
        <View style={styles.replaceModalOverlay}>
          <View style={styles.replaceModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.detailsModalTitle}>Substituir Exercício</Text>
              <TouchableOpacity onPress={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }} style={{ padding: 4 }}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ExerciseSearchInput
              value={replaceSearch}
              onChangeText={setReplaceSearch}
              placeholder="Buscar exercício..."
              onSelectExercise={(name, group, mediaUrl) => {
                onUpdateExercise({ ...exercise, name, muscleGroup: group, mediaUrl });
                setIsReplaceModalVisible(false);
                setReplaceSearch('');
              }}
            />
            <TouchableOpacity style={[styles.doneBtn, { marginTop: 14 }]}
              onPress={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }}>
              <Text style={styles.doneBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Mídia ── */}
      <Modal visible={isMediaModalVisible} transparent animationType="fade" onRequestClose={() => setIsMediaModalVisible(false)}>
        <View style={styles.mediaModalOverlay}>
          <View style={styles.mediaModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaModalTitle} numberOfLines={2}>{exercise.name}</Text>
                {exercise.muscleGroup ? <Text style={styles.mediaModalSubtitle}>{exercise.muscleGroup}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => setIsMediaModalVisible(false)} style={{ padding: 4 }}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            {exercise.mediaUrl ? (
              <Image source={{ uri: exercise.mediaUrl }} style={styles.mediaModalImage} contentFit="contain" cachePolicy="disk" transition={200} />
            ) : null}
            <Text style={styles.mediaModalCaption}>💡 Imagem ilustrativa da execução.</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setIsMediaModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    blockContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      marginHorizontal: 2,
    },

    // ── Header ──
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    titleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
    headerThumbnail: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceElevated, flexShrink: 0 },
    headerThumbnailFallback: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.surfaceBorder, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    headerThumbnailFallbackIcon: { fontSize: 22 },
    exerciseName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    muscleGroupTag: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
    exerciseIndex: { fontSize: 14, fontWeight: '900', color: colors.primary },
    iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.surfaceBorder, justifyContent: 'center', alignItems: 'center' },
    iconBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    iconBtnDanger: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', justifyContent: 'center', alignItems: 'center' },
    iconBtnDangerText: { color: colors.danger, fontSize: 14, fontWeight: '700' },

    // ── Meta Row ──
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
      gap: 8,
    },
    progressPill: { flex: 1, gap: 4 },
    progressPillText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
    progressBar: { height: 5, backgroundColor: colors.surfaceBorder, borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: 5, backgroundColor: colors.success, borderRadius: 3 },
    oneRmBadge: { alignItems: 'flex-end' },
    oneRmLabel: { fontSize: 8, fontWeight: '800', color: colors.streak, letterSpacing: 0.5 },
    oneRmValue: { fontSize: 12, fontWeight: '900', color: colors.textPrimary },
    restToggleChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
    restToggleChipText: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
    restOptionsRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
    restChip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.surfaceBorder },
    restChipActive: { backgroundColor: colors.primary },
    restChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    restChipTextActive: { color: '#0A0D14', fontWeight: '900' },

    // ── Evolution & Target Card ──
    evolutionCard: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.06)' : 'rgba(2,132,199,0.05)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '28',
      padding: 10,
      marginBottom: 10,
      gap: 8,
    },
    evolutionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    evolutionCol: {
      flex: 1,
    },
    evolutionLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    evolutionValue: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    evolutionReps: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    evolutionDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.surfaceBorder,
      marginHorizontal: 10,
    },
    evolutionMetaLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    evolutionMetaValue: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.primary,
    },
    evolutionOr: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    repeatAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(2,132,199,0.1)',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 10,
      gap: 6,
    },
    repeatAllBtnIcon: {
      fontSize: 13,
    },
    repeatAllBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },

    // ── Weight Mode Selector (Total vs Por Lado) ──
    weightModeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 2,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    weightModeTab: {
      flex: 1,
      paddingVertical: 5,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weightModeTabActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    weightModeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    weightModeTextActive: {
      color: colors.primary,
      fontWeight: '900',
    },

    // ── Sets ──
    setsSection: { marginTop: 2 },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      marginBottom: 4,
    },
    colHeader: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textAlign: 'center' },

    setGroup: {
      marginBottom: 4,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      borderRadius: 10,
      gap: 4,
    },
    setRowCompleted: { backgroundColor: 'rgba(16,185,129,0.06)' },
    setRowActive: { backgroundColor: isDark ? 'rgba(56,189,248,0.05)' : 'rgba(2,132,199,0.05)' },

    setBadge: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1.5,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumber: { fontSize: 13, fontWeight: '900' },
    setTypeTag: { fontSize: 8, fontWeight: '900', marginTop: -2 },

    weightCell: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    numericInput: {
      width: '100%',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      borderRadius: 8,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
      paddingVertical: 7,
      paddingHorizontal: 2,
    },
    numericInputActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(56,189,248,0.06)' : 'rgba(2,132,199,0.06)',
    },
    inputCompleted: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.05)' },

    totalSubText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.primary,
      marginTop: 2,
      textAlign: 'center',
    },

    completeBtn: {
      width: 76,
      height: 36,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    completeBtnDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    completeBtnText: { fontSize: 11, fontWeight: '900', color: colors.textMuted },
    completeBtnTextDone: { fontSize: 11, fontWeight: '900', color: '#0A0D14' },

    deleteSetBtn: { width: 22, justifyContent: 'center', alignItems: 'center' },
    deleteSetIcon: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },

    // ── Quick Bar (+2.5kg, +5kg, +10kg, +20kg) ──
    quickBar: {
      marginTop: 6,
      marginBottom: 6,
      padding: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 6,
    },
    quickBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    quickBtnHeavy: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(2,132,199,0.1)',
      borderColor: colors.primary + '55',
    },
    quickBtnHeavyText: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.primary,
    },

    // ── Badge de PR ──
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      marginBottom: 3,
      marginHorizontal: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#F59E0B',
      gap: 4,
    },
    prBadgeIcon: { fontSize: 12 },
    prBadgeText: { fontSize: 10, fontWeight: '900', color: '#F59E0B', letterSpacing: 0.5 },
    prBadgeSub: { fontSize: 10, fontWeight: '800', color: colors.textPrimary, marginLeft: 'auto' },

    // ── Badge de comparação pós-série ──
    deltaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      marginBottom: 3,
      marginHorizontal: 4,
      paddingVertical: 3,
      paddingHorizontal: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    deltaSymbol: { fontSize: 12, fontWeight: '900', marginRight: 3 },
    deltaText: { fontSize: 11, fontWeight: '800' },
    deltaReps: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    deltaVs: { fontSize: 10, color: colors.textMuted, marginLeft: 2 },


    addSetButton: {
      marginTop: 10,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(56,189,248,0.04)' : 'rgba(2,132,199,0.04)',
    },
    addSetButtonText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

    // ── Modals ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    detailsModalCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1.5, borderColor: colors.surfaceBorder, width: '100%', maxWidth: 360, padding: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    detailsModalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    modalCloseIcon: { fontSize: 18, color: colors.textMuted, fontWeight: '700', padding: 4 },
    modalSectionLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6, marginBottom: 8 },

    rpeChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    rpeChip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center', minWidth: 56 },
    rpeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    rpeChipValue: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
    rpeChipValueSel: { color: '#0A0D14' },
    rpeChipLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
    rpeChipLabelSel: { color: 'rgba(10,13,20,0.7)' },
    rpeChipClear: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
    rpeChipClearText: { fontSize: 12, fontWeight: '800', color: colors.danger },

    setTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 16 },
    setTypeChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.surfaceBorder },
    setTypeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    setTypeChipTextSel: { color: '#0A0D14', fontWeight: '900' },

    doneBtn: { backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    doneBtnText: { color: isDark ? '#0A0D14' : '#FFF', fontSize: 15, fontWeight: '800' },

    replaceModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    replaceModalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1.5, borderColor: colors.surfaceBorder, padding: 20, paddingBottom: 48 },

    mediaModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    mediaModalCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1.5, borderColor: colors.surfaceBorder, width: '100%', maxWidth: 380, padding: 20, overflow: 'hidden' },
    mediaModalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginRight: 8 },
    mediaModalSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
    mediaModalImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.surfaceElevated, marginTop: 14, marginBottom: 12 },
    mediaModalCaption: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginBottom: 14 },

  });
}

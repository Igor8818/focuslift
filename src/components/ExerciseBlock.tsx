import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';
import { calculate1RMBrzycki } from '../utils/oneRepMax';

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
}

export interface ExerciseBlockProps {
  exercise: ActiveExerciseState;
  index: number;
  onUpdateExercise: (updated: ActiveExerciseState) => void;
  onRemoveExercise: (id: string) => void;
  onSetCompleted: (exerciseName: string, restTimerSeconds: number) => void;
}

const REST_TIME_OPTIONS = [30, 60, 90, 120, 180];

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'N',
  warmup: 'A', // Aquecimento
  drop: 'D',   // Dropset
  failure: 'F',// Até a falha
};

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({
  exercise,
  index,
  onUpdateExercise,
  onRemoveExercise,
  onSetCompleted,
}) => {
  // Adiciona nova série herdando o peso e reps da série anterior se houver
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

    onUpdateExercise({
      ...exercise,
      sets: [...exercise.sets, newSet],
    });
  };

  // Remove uma série
  const handleRemoveSet = (setId: string) => {
    onUpdateExercise({
      ...exercise,
      sets: exercise.sets.filter((s) => s.id !== setId),
    });
  };

  // Atualiza um campo de uma série
  const handleUpdateSetField = (
    setId: string,
    field: keyof ActiveSetState,
    value: unknown
  ) => {
    const updatedSets = exercise.sets.map((s) => {
      if (s.id === setId) {
        return { ...s, [field]: value };
      }
      return s;
    });

    onUpdateExercise({
      ...exercise,
      sets: updatedSets,
    });
  };

  // Alterna o status de conclusão da série e aciona o Rest Timer
  const handleToggleComplete = (set: ActiveSetState) => {
    const newCompleted = !set.completed;
    const nowIso = newCompleted ? new Date().toISOString() : undefined;

    const updatedSets = exercise.sets.map((s) => {
      if (s.id === set.id) {
        return {
          ...s,
          completed: newCompleted,
          completedAt: nowIso,
        };
      }
      return s;
    });

    onUpdateExercise({
      ...exercise,
      sets: updatedSets,
    });

    // Se marcou como concluída, aciona o cronômetro de descanso
    if (newCompleted) {
      onSetCompleted(exercise.name, exercise.restTimerSeconds || 90);
    }
  };

  // Alterna o tipo de série ao tocar no indicador
  const handleCycleSetType = (set: ActiveSetState) => {
    const types: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
    const currentIndex = types.indexOf(set.setType);
    const nextType = types[(currentIndex + 1) % types.length];
    handleUpdateSetField(set.id, 'setType', nextType);
  };

  // Altera o tempo de descanso configurado para o exercício
  const handleChangeRestTimer = (seconds: number) => {
    onUpdateExercise({
      ...exercise,
      restTimerSeconds: seconds,
    });
  };

  // Calcula o melhor 1RM estimado em tempo real para este exercício
  let best1RM = 0;
  for (const s of exercise.sets) {
    const w = parseFloat(s.weight.replace(',', '.'));
    const r = parseInt(s.reps, 10);
    if (!isNaN(w) && w > 0 && !isNaN(r) && r > 0 && r < 37) {
      try {
        const est = calculate1RMBrzycki(w, r);
        if (est > best1RM) {
          best1RM = est;
        }
      } catch {
        // Ignora valores fora do escopo
      }
    }
  }

  return (
    <View style={styles.blockContainer}>
      {/* Cabeçalho do Exercício */}
      <View style={styles.headerRow}>
        <View style={styles.titleInfo}>
          <Text style={styles.exerciseIndex}>#{index + 1}</Text>
          <View>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.muscleGroup ? (
              <Text style={styles.muscleGroupTag}>{exercise.muscleGroup}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeExerciseBtn}
          onPress={() => onRemoveExercise(exercise.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.removeExerciseText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de Configuração de Descanso e 1RM */}
      <View style={styles.metaRow}>
        {/* Seletor de Descanso */}
        <View style={styles.restSelectContainer}>
          <Text style={styles.metaLabel}>⏱️ DESCANSO:</Text>
          <View style={styles.restOptionsRow}>
            {REST_TIME_OPTIONS.map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.restChip,
                  exercise.restTimerSeconds === sec && styles.restChipActive,
                ]}
                onPress={() => handleChangeRestTimer(sec)}
              >
                <Text
                  style={[
                    styles.restChipText,
                    exercise.restTimerSeconds === sec && styles.restChipTextActive,
                  ]}
                >
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 1RM Estimado */}
        {best1RM > 0 ? (
          <View style={styles.oneRmBadge}>
            <Text style={styles.oneRmLabel}>1RM ESTIMADO</Text>
            <Text style={styles.oneRmValue}>{best1RM.toFixed(1)} kg</Text>
          </View>
        ) : null}
      </View>

      {/* Cabeçalho da Tabela de Séries */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.columnHeader, styles.colSet]}>SET</Text>
        <Text style={[styles.columnHeader, styles.colWeight]}>PESO (KG)</Text>
        <Text style={[styles.columnHeader, styles.colReps]}>REPS</Text>
        <Text style={[styles.columnHeader, styles.colRpe]}>RPE</Text>
        <Text style={[styles.columnHeader, styles.colStatus]}>✓</Text>
        <View style={styles.colAction} />
      </View>

      {/* Linhas de Séries */}
      {exercise.sets.map((set, setIndex) => (
        <View
          key={set.id}
          style={[
            styles.setRow,
            set.completed && styles.setRowCompleted,
          ]}
        >
          {/* Número e Tipo da Série */}
          <TouchableOpacity
            style={styles.colSet}
            onPress={() => handleCycleSetType(set)}
            activeOpacity={0.7}
          >
            <View style={styles.setBadge}>
              <Text style={styles.setNumberText}>{setIndex + 1}</Text>
              {set.setType !== 'normal' ? (
                <Text style={styles.setTypeIndicator}>
                  {SET_TYPE_LABELS[set.setType]}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* Input de Peso */}
          <View style={styles.colWeight}>
            <TextInput
              style={[styles.numericInput, set.completed && styles.inputCompleted]}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={set.weight}
              onChangeText={(val) => handleUpdateSetField(set.id, 'weight', val)}
            />
          </View>

          {/* Input de Repetições */}
          <View style={styles.colReps}>
            <TextInput
              style={[styles.numericInput, set.completed && styles.inputCompleted]}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={set.reps}
              onChangeText={(val) => handleUpdateSetField(set.id, 'reps', val)}
            />
          </View>

          {/* Input de RPE (opcional) */}
          <View style={styles.colRpe}>
            <TextInput
              style={[styles.numericInput, set.completed && styles.inputCompleted]}
              placeholder="-"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              maxLength={4}
              value={set.rpe}
              onChangeText={(val) => handleUpdateSetField(set.id, 'rpe', val)}
            />
          </View>

          {/* Checkbox de Conclusão */}
          <View style={styles.colStatus}>
            <TouchableOpacity
              style={[
                styles.checkBtn,
                set.completed && styles.checkBtnCompleted,
              ]}
              onPress={() => handleToggleComplete(set)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.checkBtnIcon,
                  set.completed && styles.checkBtnIconCompleted,
                ]}
              >
                ✓
              </Text>
            </TouchableOpacity>
          </View>

          {/* Excluir Série */}
          <TouchableOpacity
            style={styles.colAction}
            onPress={() => handleRemoveSet(set.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.trashIcon}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Botão Adicionar Série */}
      <TouchableOpacity
        style={styles.addSetButton}
        onPress={handleAddSet}
        activeOpacity={0.8}
      >
        <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  blockContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseIndex: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    marginRight: 10,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  muscleGroupTag: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  removeExerciseBtn: {
    padding: 6,
  },
  removeExerciseText: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  restSelectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginRight: 8,
    letterSpacing: 0.5,
  },
  restOptionsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  restChip: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: Colors.surfaceBorder,
  },
  restChipActive: {
    backgroundColor: Colors.primary,
  },
  restChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  restChipTextActive: {
    color: '#0A0D14',
    fontWeight: '900',
  },
  oneRmBadge: {
    alignItems: 'flex-end',
  },
  oneRmLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.streak,
    letterSpacing: 0.5,
  },
  oneRmValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  colSet: {
    width: 44,
    alignItems: 'center',
  },
  colWeight: {
    flex: 1,
    marginHorizontal: 4,
  },
  colReps: {
    flex: 1,
    marginHorizontal: 4,
  },
  colRpe: {
    width: 48,
    marginHorizontal: 4,
  },
  colStatus: {
    width: 40,
    alignItems: 'center',
  },
  colAction: {
    width: 24,
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  setRowCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  setBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  setTypeIndicator: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.streak,
    marginLeft: 2,
  },
  numericInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderRadius: 8,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  inputCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkBtnIcon: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '900',
  },
  checkBtnIconCompleted: {
    color: '#0A0D14',
  },
  trashIcon: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  addSetButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addSetButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

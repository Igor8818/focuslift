import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Colors } from '../theme/colors';
import { calculate1RMBrzycki } from '../utils/oneRepMax';
import { getLastWorkoutSetsForExercise, type WorkoutSet } from '../database/db';
import { COMMON_SUGGESTIONS } from '../utils/constants';
import { ScrollView } from 'react-native';

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
  // Controle de visibilidade da coluna RPE (oculta por padrão)
  const [showRpe, setShowRpe] = useState(false);
  const [detailsSet, setDetailsSet] = useState<ActiveSetState | null>(null);

  const [previousSets, setPreviousSets] = useState<WorkoutSet[] | null>(null);
  const [isReplaceModalVisible, setIsReplaceModalVisible] = useState(false);

  React.useEffect(() => {
    let isMounted = true;
    getLastWorkoutSetsForExercise(exercise.name).then((sets) => {
      if (isMounted && sets) {
        setPreviousSets(sets);
      }
    });
    return () => { isMounted = false; };
  }, [exercise.name]);

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

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.replaceExerciseBtn}
            onPress={() => setIsReplaceModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.replaceExerciseText}>Substituir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeExerciseBtn}
            onPress={() => onRemoveExercise(exercise.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.removeExerciseText}>✕</Text>
          </TouchableOpacity>
        </View>
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
        
        {/* Alternador discreto de RPE no cabeçalho */}
        <TouchableOpacity
          style={[styles.rpeToggleHeader, showRpe && styles.rpeToggleHeaderActive]}
          onPress={() => setShowRpe(!showRpe)}
          activeOpacity={0.7}
        >
          <Text style={[styles.rpeToggleHeaderText, showRpe && styles.rpeToggleHeaderTextActive]}>
            {showRpe ? 'RPE ✕' : '+ RPE'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.columnHeader, styles.colStatus]}>✓</Text>
        <View style={styles.colAction} />
      </View>

      {/* Linhas de Séries */}
      {exercise.sets.map((set, setIndex) => {
        const prevSet = previousSets ? previousSets[setIndex] : null;
        return (
        <View key={set.id} style={{ marginBottom: 4 }}>
          <View
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
              style={[
                styles.numericInput,
                styles.numericInputLarge,
                set.completed && styles.inputCompleted,
              ]}
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
              style={[
                styles.numericInput,
                styles.numericInputLarge,
                set.completed && styles.inputCompleted,
              ]}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={set.reps}
              onChangeText={(val) => handleUpdateSetField(set.id, 'reps', val)}
            />
          </View>

          {/* Campo RPE (Exibição Dinâmica ou Botão Discreto de Detalhes) */}
          {showRpe ? (
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
          ) : (
            <TouchableOpacity
              style={[
                styles.rowDetailsBtn,
                !!set.rpe && styles.rowDetailsBtnActive,
              ]}
              onPress={() => setDetailsSet(set)}
              activeOpacity={0.7}
              accessibilityLabel="Detalhes e RPE da série"
            >
              <Text
                style={[
                  styles.rowDetailsBtnText,
                  !!set.rpe && styles.rowDetailsBtnTextActive,
                ]}
              >
                {set.rpe ? `@${set.rpe}` : '⚙️'}
              </Text>
            </TouchableOpacity>
          )}

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
        {prevSet && !set.completed && (
          <Text style={styles.ghostDataText}>
            Anterior: {prevSet.weight} kg × {prevSet.reps} reps
          </Text>
        )}
      </View>
      )})}

      {/* Botão Adicionar Série */}
      <TouchableOpacity
        style={styles.addSetButton}
        onPress={handleAddSet}
        activeOpacity={0.8}
      >
        <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
      </TouchableOpacity>

      {/* =================================================================
          MODAL DISCRETO DE DETALHES DA SÉRIE (RPE & TIPO)
          ================================================================= */}
      <Modal
        visible={detailsSet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsSet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.detailsModalTitle}>
                Configurações da Série
              </Text>
              <TouchableOpacity
                onPress={() => setDetailsSet(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailsSet ? (
              <>
                <Text style={styles.modalSectionLabel}>ESFORÇO PERCEBIDO (RPE)</Text>
                <Text style={styles.modalSectionDesc}>
                  Escala de 1 a 10 de proximidade da falha muscular.
                </Text>

                {/* Chips Rápidos de RPE */}
                <View style={styles.rpeChipsGrid}>
                  {['6', '7', '7.5', '8', '8.5', '9', '9.5', '10'].map((val) => {
                    const isSelected = detailsSet.rpe === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.rpeChip,
                          isSelected && styles.rpeChipSelected,
                        ]}
                        onPress={() => {
                          handleUpdateSetField(detailsSet.id, 'rpe', val);
                          setDetailsSet((prev) => (prev ? { ...prev, rpe: val } : null));
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.rpeChipText,
                            isSelected && styles.rpeChipTextSelected,
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.rpeChipClear}
                    onPress={() => {
                      handleUpdateSetField(detailsSet.id, 'rpe', '');
                      setDetailsSet((prev) => (prev ? { ...prev, rpe: '' } : null));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.rpeChipClearText}>Limpar</Text>
                  </TouchableOpacity>
                </View>

                {/* Tipo de Série */}
                <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>
                  TIPO DE SÉRIE
                </Text>
                <View style={styles.setTypeRow}>
                  {(
                    [
                      { type: 'normal', label: 'Normal' },
                      { type: 'warmup', label: 'Aquecimento' },
                      { type: 'drop', label: 'Drop-set' },
                      { type: 'failure', label: 'Até a Falha' },
                    ] as const
                  ).map((item) => {
                    const isSelected = detailsSet.setType === item.type;
                    return (
                      <TouchableOpacity
                        key={item.type}
                        style={[
                          styles.setTypeChip,
                          isSelected && styles.setTypeChipSelected,
                        ]}
                        onPress={() => {
                          handleUpdateSetField(detailsSet.id, 'setType', item.type);
                          setDetailsSet((prev) =>
                            prev ? { ...prev, setType: item.type } : null
                          );
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.setTypeChipText,
                            isSelected && styles.setTypeChipTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Alternar Coluna RPE na Tabela */}
                <TouchableOpacity
                  style={styles.showTableColumnBtn}
                  onPress={() => {
                    setShowRpe(true);
                    setDetailsSet(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.showTableColumnBtnText}>
                    Exibir coluna RPE sempre na tabela
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneDetailsBtn}
                  onPress={() => setDetailsSet(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.doneDetailsBtnText}>Pronto</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      {/* =================================================================
          MODAL SUBSTITUIR EXERCÍCIO
          ================================================================= */}
      <Modal
        visible={isReplaceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReplaceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            <Text style={styles.detailsModalTitle}>Substituir Exercício</Text>
            <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
              {COMMON_SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s.name}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder }}
                  onPress={() => {
                    onUpdateExercise({
                      ...exercise,
                      name: s.name,
                      muscleGroup: s.group,
                    });
                    setIsReplaceModalVisible(false);
                  }}
                >
                  <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>{s.name}</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{s.group}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.doneDetailsBtn} onPress={() => setIsReplaceModalVisible(false)}>
              <Text style={styles.doneDetailsBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  replaceExerciseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  replaceExerciseText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  ghostDataText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
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
  rpeToggleHeader: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginHorizontal: 4,
  },
  rpeToggleHeaderActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.primary,
  },
  rpeToggleHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  rpeToggleHeaderTextActive: {
    color: Colors.primary,
  },
  numericInputLarge: {
    fontSize: 16,
    paddingVertical: 8,
  },
  rowDetailsBtn: {
    width: 32,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rowDetailsBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: Colors.primary,
  },
  rowDetailsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  rowDetailsBtnTextActive: {
    color: Colors.primary,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    width: '100%',
    maxWidth: 360,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  modalSectionDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  rpeChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  rpeChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  rpeChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rpeChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rpeChipTextSelected: {
    color: '#0A0D14',
    fontWeight: '900',
  },
  rpeChipClear: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rpeChipClearText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.danger,
  },
  setTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 16,
  },
  setTypeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  setTypeChipSelected: {
    backgroundColor: Colors.streak,
    borderColor: Colors.streak,
  },
  setTypeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  setTypeChipTextSelected: {
    color: '#0A0D14',
    fontWeight: '900',
  },
  showTableColumnBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 10,
  },
  showTableColumnBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  doneDetailsBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneDetailsBtnText: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '800',
  },
});

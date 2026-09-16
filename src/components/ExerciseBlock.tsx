import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
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
  /** URL de imagem/GIF demonstrando a execução. Vem do COMMON_SUGGESTIONS e não é persistido no banco. */
  mediaUrl?: string;
}

export interface ExerciseBlockProps {
  exercise: ActiveExerciseState;
  index: number;
  onUpdateExercise: (updated: ActiveExerciseState) => void;
  onRemoveExercise: (id: string) => void;
  onSetCompleted: (exerciseName: string, restTimerSeconds: number) => void;
}

const REST_TIME_OPTIONS = [30, 60, 90, 120, 180, 300];

/**
 * Formata segundos para exibição compacta nos chips de descanso.
 * < 60s → "30s" | >= 60s → "1:00", "1:30", "3:00", "5:00"
 */
function formatRestTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

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
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  // Controle de visibilidade da coluna RPE (oculta por padrão)
  const [showRpe, setShowRpe] = useState(false);
  const [detailsSet, setDetailsSet] = useState<ActiveSetState | null>(null);
  const [previousSets, setPreviousSets] = useState<WorkoutSet[] | null>(null);
  const [isReplaceModalVisible, setIsReplaceModalVisible] = useState(false);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [isMediaModalVisible, setIsMediaModalVisible] = useState(false);

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
          
          {/* Nova Miniatura Permanente */}
          {exercise.mediaUrl ? (
            <Image
              source={{ uri: exercise.mediaUrl }}
              style={styles.headerThumbnail}
              contentFit="cover"
              cachePolicy="disk"
              transition={150}
            />
          ) : (
            <View style={styles.headerThumbnailFallback}>
              <Text style={styles.headerThumbnailFallbackIcon}>💪</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
              {/* Botão ℹ️ — para abrir o modal de mídia em tela cheia */}
              {exercise.mediaUrl ? (
                <TouchableOpacity
                  onPress={() => setIsMediaModalVisible(true)}
                  activeOpacity={0.7}
                  style={styles.infoBtn}
                  accessibilityLabel={`Ver execução de ${exercise.name}`}
                >
                  <Text style={styles.infoBtnText}>ℹ️</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
                  {formatRestTime(sec)}
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
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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

                {/* Chips de RPE — ordem decrescente (10 = falha, 6 = mais fácil) */}
                <View style={styles.rpeChipsGrid}>
                  {[
                    { val: '10', label: 'Falha' },
                    { val: '9.5', label: '½ rep' },
                    { val: '9',   label: '1 rep' },
                    { val: '8.5', label: '1½ rep' },
                    { val: '8',   label: '2 reps' },
                    { val: '7.5', label: '2½ rep' },
                    { val: '7',   label: '3 reps' },
                    { val: '6',   label: '4+ reps' },
                  ].map(({ val, label }) => {
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
                            styles.rpeChipValue,
                            isSelected && styles.rpeChipValueSelected,
                          ]}
                        >
                          {val}
                        </Text>
                        <Text
                          style={[
                            styles.rpeChipLabel,
                            isSelected && styles.rpeChipLabelSelected,
                          ]}
                        >
                          {label}
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
                <Text style={styles.rpeLegend}>
                  💡 RPE = reps que sobraram na reserva (RIR)
                </Text>

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
          MODAL SUBSTITUIR EXERCÍCIO (com busca de autocomplete)
          ================================================================= */}
      <Modal
        visible={isReplaceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }}
      >
        <View style={styles.replaceModalOverlay}>
          <View style={styles.replaceModalCard}>
            <View style={styles.replaceModalHeader}>
              <Text style={styles.replaceModalTitle}>Substituir Exercício</Text>
              <TouchableOpacity
                onPress={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }}
                activeOpacity={0.7}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ExerciseSearchInput
              value={replaceSearch}
              onChangeText={setReplaceSearch}
              placeholder="Buscar exercício para substituir..."
              onSelectExercise={(name, group, mediaUrl) => {
                onUpdateExercise({ ...exercise, name, muscleGroup: group, mediaUrl });
                setIsReplaceModalVisible(false);
                setReplaceSearch('');
              }}
            />

            <TouchableOpacity
              style={[styles.doneDetailsBtn, { marginTop: 14 }]}
              onPress={() => { setIsReplaceModalVisible(false); setReplaceSearch(''); }}
            >
              <Text style={styles.doneDetailsBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================================
          MODAL DE MÍDIA — Visualização da execução do exercício
          ================================================================= */}
      <Modal
        visible={isMediaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMediaModalVisible(false)}
      >
        <View style={styles.mediaModalOverlay}>
          <View style={styles.mediaModalCard}>
            {/* Header do modal */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaModalTitle} numberOfLines={2}>
                  {exercise.name}
                </Text>
                {exercise.muscleGroup ? (
                  <Text style={styles.mediaModalSubtitle}>{exercise.muscleGroup}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setIsMediaModalVisible(false)}
                activeOpacity={0.7}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Imagem / GIF da execução */}
            {exercise.mediaUrl ? (
              <Image
                source={{ uri: exercise.mediaUrl }}
                style={styles.mediaModalImage}
                contentFit="contain"
                cachePolicy="disk"
                transition={200}
              />
            ) : null}

            <Text style={styles.mediaModalCaption}>
              💡 Imagem ilustrativa da execução do exercício.
            </Text>

            <TouchableOpacity
              style={styles.doneDetailsBtn}
              onPress={() => setIsMediaModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.doneDetailsBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  replaceExerciseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  replaceExerciseText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  replaceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  replaceModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    padding: 20,
    paddingBottom: 36,
  },
  replaceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  replaceModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  ghostDataText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  blockContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    padding: 16,
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
    color: colors.primary,
    marginRight: 10,
  },
  headerThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    marginRight: 12,
    flexShrink: 0,
  },
  headerThumbnailFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  headerThumbnailFallbackIcon: {
    fontSize: 20,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  muscleGroupTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeExerciseBtn: {
    padding: 6,
  },
  removeExerciseText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  infoBtn: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
  },
  infoBtnText: {
    fontSize: 15,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
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
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceBorder,
  },
  restChipActive: {
    backgroundColor: colors.primary,
  },
  restChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
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
    color: colors.streak,
    letterSpacing: 0.5,
  },
  oneRmValue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    marginBottom: 8,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  setTypeIndicator: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.streak,
    marginLeft: 2,
  },
  numericInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    color: colors.textPrimary,
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
    borderColor: colors.surfaceBorder,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkBtnIcon: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '900',
  },
  checkBtnIconCompleted: {
    color: '#0A0D14',
  },
  trashIcon: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  addSetButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addSetButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  rpeToggleHeader: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginHorizontal: 4,
  },
  rpeToggleHeaderActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: colors.primary,
  },
  rpeToggleHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
  rpeToggleHeaderTextActive: {
    color: colors.primary,
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
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rowDetailsBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: colors.primary,
  },
  rowDetailsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  rowDetailsBtnTextActive: {
    color: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
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
    color: colors.textPrimary,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  modalSectionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
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
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    minWidth: 56,
  },
  rpeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rpeChipValue: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  rpeChipValueSelected: {
    color: '#0A0D14',
  },
  rpeChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  rpeChipLabelSelected: {
    color: 'rgba(10, 13, 20, 0.7)',
  },
  rpeLegend: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
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
    color: colors.danger,
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  setTypeChipSelected: {
    backgroundColor: colors.streak,
    borderColor: colors.streak,
  },
  setTypeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  setTypeChipTextSelected: {
    color: '#0A0D14',
    fontWeight: '900',
  },
  showTableColumnBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 10,
  },
  showTableColumnBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  doneDetailsBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneDetailsBtnText: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Modal de Mídia (execução do exercício) ──────────────────────────────────
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mediaModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    width: '100%',
    maxWidth: 380,
    padding: 20,
    overflow: 'hidden',
  },
  mediaModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginRight: 8,
    lineHeight: 22,
  },
  mediaModalSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 3,
  },
  mediaModalImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    marginTop: 16,
    marginBottom: 12,
  },
  mediaModalCaption: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 15,
  },
});
}


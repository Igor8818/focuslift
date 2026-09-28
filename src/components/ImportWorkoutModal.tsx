import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { createRoutine, type RoutineWithExercises } from '../database/db';
import { parseWorkoutText, type ParsedRoutine, type ParsedExercise } from '../utils/workoutTextParser';

export interface ImportWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutinesCreated: (created: RoutineWithExercises[]) => void;
}

const SAMPLE_TEXT_ABC = `SEGUNDA-FEIRA: Push (Peito, Ombro e Tríceps)
Foco em Peito Superior e Deltoide Anterior/Medial
Supino Inclinado com Halteres: 2 séries preparatórias + 2 séries válidas (6 a 8 reps).
Supino Reto com Barra: 2 séries válidas (8 a 10 reps).
Crossover na Polia: 2 séries válidas (10 a 12 reps) — Mirando no miolo do peitoral.
Desenvolvimento com Halteres: 2 séries válidas (8 a 10 reps).
Tríceps Francês com Halter: 2 séries válidas (10 a 12 reps).

TERÇA-FEIRA: Pull (Costas e Bíceps)
Foco em Densidade e Espessura
Puxada Alta Aberta: 2 séries preparatórias + 2 séries válidas (8 a 10 reps).
Remada Curvada com Barra: 2 séries válidas (8 a 10 reps).
Remada Sentada na Polia: 2 séries válidas (10 a 12 reps).
Rosca Direta com Barra: 2 séries válidas (10 a 12 reps).
Rosca Martelo com Halteres: 2 séries válidas (10 a 12 reps).

QUARTA-FEIRA: Pernas (Quadríceps e Posterior)
Agachamento Hack: 2 séries preparatórias + 2 séries válidas (6 a 8 reps).
Leg Press 45°: 3 séries válidas (8 a 10 reps).
Cadeira Extensora: 2 séries válidas (12 a 15 reps + dropset).
Mesa Flexora: 3 séries válidas (10 a 12 reps).
Panturrilha em Pé na Máquina: 3 séries válidas (12 a 15 reps).`;

const SAMPLE_TEXT_SIMPLE = `TREINO A: Peito, Ombro e Tríceps
Supino Reto com Barra: 4x10
Supino Inclinado com Halteres: 3x12
Desenvolvimento com Halteres: 3x10
Elevação Lateral com Halteres: 4x15
Tríceps Corda na Polia: 3x12`;

export const ImportWorkoutModal: React.FC<ImportWorkoutModalProps> = ({
  visible,
  onClose,
  onRoutinesCreated,
}) => {
  const { colors, isDark } = useTheme();
  const [inputText, setInputText] = useState('');
  const [showTips, setShowTips] = useState(false);
  const [parsedRoutines, setParsedRoutines] = useState<ParsedRoutine[]>([]);
  const [activeRoutineIndex, setActiveRoutineIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleParse = () => {
    if (!inputText.trim()) {
      Alert.alert('Texto Vazio', 'Por favor, cole ou digite o texto do seu treino antes de continuar.');
      return;
    }

    setIsProcessing(true);
    try {
      const results = parseWorkoutText(inputText);
      if (results.length === 0 || results.every((r) => r.exercises.length === 0 && !r.isRestDay)) {
        Alert.alert(
          'Nenhum Exercício Detectado',
          'Não conseguimos identificar os exercícios no texto. Verifique o formato (ex: "Nome do Exercício: 3x10" ou "Supino: 3 séries válidas").'
        );
        setIsProcessing(false);
        return;
      }

      setParsedRoutines(results);
      setActiveRoutineIndex(0);
      setStep('preview');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.error('Erro ao processar texto do treino:', e);
      Alert.alert('Erro ao Processar', 'Ocorreu um problema ao analisar o texto. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSample = (type: 'abc' | 'simple' = 'abc') => {
    setInputText(type === 'abc' ? SAMPLE_TEXT_ABC : SAMPLE_TEXT_SIMPLE);
    setShowTips(false);
  };

  const handleClear = () => {
    setInputText('');
    setParsedRoutines([]);
    setStep('input');
  };

  const handleUpdateRoutineName = (index: number, newName: string) => {
    setParsedRoutines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: newName };
      return copy;
    });
  };

  const handleRemoveExercise = (routineIndex: number, exerciseIndex: number) => {
    setParsedRoutines((prev) => {
      const copy = [...prev];
      const targetRoutine = { ...copy[routineIndex] };
      targetRoutine.exercises = targetRoutine.exercises.filter((_, idx) => idx !== exerciseIndex);
      copy[routineIndex] = targetRoutine;
      return copy;
    });
  };

  const handleAdjustSets = (routineIndex: number, exerciseIndex: number, delta: number) => {
    setParsedRoutines((prev) => {
      const copy = [...prev];
      const targetRoutine = { ...copy[routineIndex] };
      const ex = { ...targetRoutine.exercises[exerciseIndex] };
      ex.targetSets = Math.min(Math.max((ex.targetSets || 3) + delta, 1), 10);
      targetRoutine.exercises[exerciseIndex] = ex;
      copy[routineIndex] = targetRoutine;
      return copy;
    });
  };

  const handleSaveAll = async () => {
    const validRoutines = parsedRoutines.filter((r) => r.exercises.length > 0);
    if (validRoutines.length === 0) {
      Alert.alert('Sem Exercícios', 'Todas as rotinas estão vazias. Adicione pelo menos um exercício.');
      return;
    }

    setIsSaving(true);
    try {
      const createdList: RoutineWithExercises[] = [];

      for (const r of validRoutines) {
        const created = await createRoutine({
          name: r.name,
          description: r.description,
          color: r.color,
          exercises: r.exercises.map((ex, idx) => ({
            exercise_name: ex.name,
            muscle_group: ex.muscleGroup,
            target_sets: ex.targetSets,
            rest_timer_seconds: ex.restTimerSeconds,
            order_index: idx,
          })),
        });
        createdList.push(created);
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      Alert.alert(
        'Fichas Criadas com Sucesso! 🎉',
        `${createdList.length} ${createdList.length === 1 ? 'ficha foi adicionada' : 'fichas foram adicionadas'} ao seu FocusLift com fotos e séries configuradas!`,
        [
          {
            text: 'OK',
            onPress: () => {
              onRoutinesCreated(createdList);
              handleClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao salvar fichas importadas:', error);
      Alert.alert('Erro ao Salvar', 'Não foi possível salvar todas as fichas no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setInputText('');
    setParsedRoutines([]);
    setStep('input');
    onClose();
  };

  const currentRoutine = parsedRoutines[activeRoutineIndex];
  const totalExercisesCount = parsedRoutines.reduce((acc, r) => acc + r.exercises.length, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.surfaceBorder }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {step === 'input' ? 'Importar Treino por Texto' : 'Revisão das Fichas'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {step === 'input'
                ? 'Cole mensagens do WhatsApp, personal ou ChatGPT'
                : `${parsedRoutines.length} fichas • ${totalExercisesCount} exercícios identificados`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* STEP 1: ENTRADA DE TEXTO */}
        {step === 'input' ? (
          <View style={styles.inputStepContainer}>
            <View style={styles.actionsBar}>
              <View style={styles.actionsLeftGroup}>
                <TouchableOpacity
                  style={[
                    styles.smallActionBtn,
                    { borderColor: showTips ? colors.primary : colors.surfaceBorder },
                    showTips && { backgroundColor: `${colors.primary}18` },
                  ]}
                  onPress={() => setShowTips((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: showTips ? colors.primary : colors.textPrimary }]}>
                    💡 {showTips ? 'Ocultar Dicas' : 'Como Colar?'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallActionBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => handleLoadSample('abc')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: colors.primary }]}>
                    📝 Exemplo ABC
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallActionBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => handleLoadSample('simple')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: colors.primary }]}>
                    ⚡ Simples
                  </Text>
                </TouchableOpacity>
              </View>

              {inputText.length > 0 && (
                <TouchableOpacity
                  style={[styles.smallActionBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: colors.textSecondary }]}>
                    Limpar
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Cartão de Dicas de Formatação */}
            {showTips && (
              <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <Text style={[styles.tipsCardTitle, { color: colors.textPrimary }]}>
                  💡 Como colar seu treino para dar 100% certo:
                </Text>

                <View style={styles.tipItem}>
                  <Text style={styles.tipIcon}>📱</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>WhatsApp / Notas / Personal:</Text> Pode colar tudo! O FocusLift remove automaticamente saudações, horários, emojis e marcações em *negrito*.
                  </Text>
                </View>

                <View style={styles.tipItem}>
                  <Text style={styles.tipIcon}>📅</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Divisão de Dias:</Text> Nomes como <Text style={{ color: colors.primary, fontWeight: '700' }}>SEGUNDA</Text>, <Text style={{ color: colors.primary, fontWeight: '700' }}>TERÇA</Text>, <Text style={{ color: colors.primary, fontWeight: '700' }}>TREINO A/B/C</Text> ou <Text style={{ color: colors.primary, fontWeight: '700' }}>Push/Pull</Text> criam as fichas separadas automaticamente.
                  </Text>
                </View>

                <View style={styles.tipItem}>
                  <Text style={styles.tipIcon}>🔢</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Séries & Repetições:</Text> Reconhece formatos naturais como <Text style={{ color: colors.primary, fontWeight: '700' }}>3x10</Text>, <Text style={{ color: colors.primary, fontWeight: '700' }}>4x 8 a 12</Text>, ou <Text style={{ color: colors.primary, fontWeight: '700' }}>2 preparatórias + 2 válidas</Text>.
                  </Text>
                </View>

                <View style={styles.tipItem}>
                  <Text style={styles.tipIcon}>🖼️</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Fotos Automáticas:</Text> Exercícios reconhecidos ganham foto de execução na hora!
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceBorder,
                  color: colors.textPrimary,
                },
              ]}
              multiline
              textAlignVertical="top"
              placeholder="Cole aqui o texto do seu treino...&#10;&#10;Exemplo:&#10;SEGUNDA-FEIRA: Peito e Tríceps&#10;Supino Reto com Barra: 3x10&#10;Crucifixo com Halteres: 3x12&#10;Tríceps Corda: 3x15&#10;&#10;TERÇA-FEIRA: Costas e Bíceps&#10;Puxada Alta Aberta: 4x10&#10;Rosca Direta: 3x10"
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  (!inputText.trim() || isProcessing) && styles.disabledBtn,
                ]}
                onPress={handleParse}
                disabled={!inputText.trim() || isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#0A0D14" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Processar Treino ✨</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* STEP 2: PREVIEW / REVISÃO */
          <View style={styles.previewStepContainer}>
            {/* Tabs das Rotinas Encontradas */}
            <View style={styles.tabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {parsedRoutines.map((routine, idx) => {
                  const isActive = idx === activeRoutineIndex;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.routineTab,
                        { borderColor: colors.surfaceBorder },
                        isActive && { backgroundColor: routine.color, borderColor: routine.color },
                      ]}
                      onPress={() => setActiveRoutineIndex(idx)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.routineTabText,
                          { color: isActive ? '#0A0D14' : colors.textSecondary },
                          isActive && { fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {routine.name.split(':')[0]} ({routine.exercises.length})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Conteúdo da Rotina Ativa */}
            {currentRoutine && (
              <ScrollView style={styles.routineContent} contentContainerStyle={styles.routineContentInner}>
                {/* Dica de Revisão */}
                <View style={[styles.previewHintCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                  <Text style={[styles.previewHintText, { color: colors.textSecondary }]}>
                    💡 <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Dica de Revisão:</Text> Você pode editar o nome da ficha, ajustar as séries com <Text style={{ color: colors.primary, fontWeight: '800' }}>[+]</Text> e <Text style={{ color: colors.primary, fontWeight: '800' }}>[−]</Text> ou excluir exercícios antes de salvar!
                  </Text>
                </View>

                {/* Nome e Descrição da Rotina */}
                <View style={[styles.routineHeaderCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nome da Ficha:</Text>
                  <TextInput
                    style={[styles.routineNameInput, { color: colors.textPrimary, borderColor: colors.surfaceBorder }]}
                    value={currentRoutine.name}
                    onChangeText={(val) => handleUpdateRoutineName(activeRoutineIndex, val)}
                  />

                  {currentRoutine.description && (
                    <View style={styles.descriptionRow}>
                      <Text style={[styles.descriptionTag, { backgroundColor: `${currentRoutine.color}20`, color: currentRoutine.color }]}>
                        {currentRoutine.description}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Lista de Exercícios */}
                {currentRoutine.isRestDay && currentRoutine.exercises.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                    <Text style={styles.emptyIcon}>😴</Text>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Dia de Descanso</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Esta rotina foi marcada como descanso total ou recuperação.
                    </Text>
                  </View>
                ) : (
                  currentRoutine.exercises.map((ex, exIdx) => (
                    <View
                      key={`${ex.name}-${exIdx}`}
                      style={[styles.exerciseCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                    >
                      {/* Thumbnail do Exercício */}
                      <View style={styles.thumbWrapper}>
                        {ex.mediaUrl ? (
                          <Image
                            source={{ uri: ex.mediaUrl }}
                            style={styles.exerciseImage}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={[styles.imageFallback, { backgroundColor: colors.surfaceBorder }]}>
                            <Text style={styles.imageFallbackText}>🏋️</Text>
                          </View>
                        )}
                      </View>

                      {/* Informações */}
                      <View style={styles.exerciseDetails}>
                        <Text style={[styles.exerciseName, { color: colors.textPrimary }]} numberOfLines={2}>
                          {ex.name}
                        </Text>
                        <View style={styles.badgeRow}>
                          <Text style={[styles.groupBadge, { backgroundColor: colors.surfaceBorder, color: colors.textSecondary }]}>
                            {ex.muscleGroup}
                          </Text>
                          <Text style={[styles.repsBadge, { backgroundColor: `${colors.primary}20`, color: colors.primary }]}>
                            {ex.targetReps} reps
                          </Text>
                        </View>

                        {ex.notes && (
                          <Text style={[styles.notesText, { color: colors.textSecondary }]} numberOfLines={2}>
                            💡 {ex.notes}
                          </Text>
                        )}

                        {/* Stepper de Séries e Tempo de Descanso */}
                        <View style={styles.stepperRow}>
                          <View style={styles.inlineStepper}>
                            <TouchableOpacity
                              style={[styles.stepBtn, { backgroundColor: colors.surfaceBorder }]}
                              onPress={() => handleAdjustSets(activeRoutineIndex, exIdx, -1)}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.stepValue, { color: colors.textPrimary }]}>
                              {ex.targetSets} {ex.targetSets === 1 ? 'série' : 'séries'}
                            </Text>
                            <TouchableOpacity
                              style={[styles.stepBtn, { backgroundColor: colors.surfaceBorder }]}
                              onPress={() => handleAdjustSets(activeRoutineIndex, exIdx, 1)}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
                            </TouchableOpacity>
                          </View>

                          <Text style={[styles.restTimerText, { color: colors.textSecondary }]}>
                            ⏱️ {ex.restTimerSeconds}s
                          </Text>
                        </View>
                      </View>

                      {/* Botão de Excluir Exercício */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleRemoveExercise(activeRoutineIndex, exIdx)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* Botões do Rodapé no Modo Preview */}
            <View style={[styles.previewFooter, { borderTopColor: colors.surfaceBorder, backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.backBtn, { borderColor: colors.surfaceBorder }]}
                onPress={() => setStep('input')}
                disabled={isSaving}
              >
                <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>← Editar Texto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveAllBtn, { backgroundColor: colors.primary }, isSaving && styles.disabledBtn]}
                onPress={handleSaveAll}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#0A0D14" size="small" />
                ) : (
                  <Text style={styles.saveAllBtnText}>
                    Salvar Fichas ({validRoutinesCount(parsedRoutines)}) 🚀
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

function validRoutinesCount(routines: ParsedRoutine[]): number {
  return routines.filter((r) => r.exercises.length > 0).length;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputStepContainer: {
    flex: 1,
    padding: 16,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  actionsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  tipsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  tipsCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  previewHintCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  previewHintText: {
    fontSize: 12,
    lineHeight: 18,
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  footer: {
    paddingTop: 14,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#0A0D14',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  previewStepContainer: {
    flex: 1,
  },
  tabsContainer: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  routineTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  routineTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  routineContent: {
    flex: 1,
  },
  routineContentInner: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  routineHeaderCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  routineNameInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  descriptionRow: {
    marginTop: 8,
  },
  descriptionTag: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  exerciseCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'flex-start',
  },
  thumbWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 24,
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  groupBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  repsBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  restTimerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
  deleteBtnText: {
    color: '#F43F5E',
    fontSize: 16,
    fontWeight: '700',
  },
  previewFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveAllBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAllBtnText: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '800',
  },
});

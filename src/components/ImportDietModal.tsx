import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { parseDietText, type ParsedDietPlan } from '../utils/dietTextParser';
import { saveDietPlan, type StoredDietPlan } from '../database/db';

export interface ImportDietModalProps {
  visible: boolean;
  initialRawText?: string;
  onClose: () => void;
  onSaved: (saved: StoredDietPlan) => void;
}

const SAMPLE_DIET_CUTTING = `PLANO ALIMENTAR - CUTTING
Meta Seg a Sex: ~2.200 kcal | ~175-180g Prot | ~228g Carb | ~65g Gord (já contando preparo)
Meta Sáb e Dom: ~2.750 kcal | ~185g Prot (manter refeições base + 1 refeição livre controlada)
Água: 4 litros/dia

09:00 - CAFÉ DA MANHÃ
- 3 ovos inteiros (mexidos ou cozidos)
- 100g cuscuz cozido (ou 2 fatias de pão de forma)
- Café preto (puro ou com adoçante)
*Opção p/ variar: 2 ovos + 40g frango desfiado

12:00 - PRÉ-TREINO (1h30 antes do treino)
- 40g Whey Concentrado
- 250ml leite desnatado
- 40g aveia em flocos
- 1 banana média (80g)

15:30 - ALMOÇO (PÓS-TREINO)
Base fixa:
- 200g arroz cozido
- 150g feijão cozido
- Salada à vontade
Proteína (escolher 1 opção - peso pronto):
- 150g peito de frango grelhado
- 150g patinho / carne magra
- 140g lombo suíno magro

19:30 - JANTAR
Base fixa:
- 120g cuscuz ou arroz cozido
- Legumes/salada à vontade
Proteína (escolher 1 opção - peso pronto):
- 120g peito de frango + 20g requeijão light
- 120g carne moída magra

22:00 - CEIA (MOUSSE PROTEICO)
- 30g Whey Concentrado
- 170g iogurte natural desnatado

REGRAS RÁPIDAS
- Conversão: 1 ovo inteiro ≈ 20-25g de carne/frango pronto
- Preparo: usar mínimo de óleo nos preparos`;

export const ImportDietModal: React.FC<ImportDietModalProps> = ({
  visible,
  initialRawText = '',
  onClose,
  onSaved,
}) => {
  const { colors } = useTheme();
  const [inputText, setInputText] = useState(initialRawText);
  const [showTips, setShowTips] = useState(false);
  const [parsedPlan, setParsedPlan] = useState<ParsedDietPlan | null>(null);
  const [syncTargets, setSyncTargets] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  useEffect(() => {
    if (visible) {
      setInputText(initialRawText || '');
      setParsedPlan(null);
      setStep('input');
      setShowTips(false);
    }
  }, [visible, initialRawText]);

  const handleParse = () => {
    if (!inputText.trim()) {
      Alert.alert('Texto Vazio', 'Cole ou digite o texto da sua dieta antes de continuar.');
      return;
    }

    const result = parseDietText(inputText);
    if (result.meals.length === 0) {
      Alert.alert(
        'Nenhuma Refeição Detectada',
        'Não conseguimos identificar os horários ou refeições no texto. Use títulos como "09:00 - CAFÉ DA MANHÃ", "Almoço" ou "Jantar".'
      );
      return;
    }

    setParsedPlan(result);
    setStep('preview');
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleRemoveMeal = (mealId: string) => {
    setParsedPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.filter((m) => m.id !== mealId),
      };
    });
  };

  const handleSave = async () => {
    if (!parsedPlan || parsedPlan.meals.length === 0) {
      Alert.alert('Plano Vazio', 'Adicione pelo menos uma refeição antes de salvar.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveDietPlan(parsedPlan, inputText, syncTargets);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      onSaved(saved);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar dieta:', error);
      Alert.alert('Erro ao Salvar', 'Não foi possível salvar o plano alimentar no banco local.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setParsedPlan(null);
    onClose();
  };

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
              {step === 'input' ? 'Importar Dieta por Texto' : 'Revisão do Plano Alimentar'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {step === 'input'
                ? 'Cole do WhatsApp, nutricionista, ChatGPT ou notas'
                : `${parsedPlan?.meals.length ?? 0} horários • Água ${((parsedPlan?.waterTargetMl ?? 3000) / 1000).toFixed(1)}L/dia`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {step === 'input' ? (
          <View style={styles.inputContainer}>
            {/* Barra de ações rápidas */}
            <View style={styles.actionsBar}>
              <View style={styles.actionsLeft}>
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    { borderColor: showTips ? colors.primary : colors.surfaceBorder },
                    showTips && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => setShowTips((v) => !v)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={14}
                    color={showTips ? colors.primary : colors.textPrimary}
                  />
                  <Text style={[styles.smallBtnText, { color: showTips ? colors.primary : colors.textPrimary }]}>
                    {showTips ? 'Ocultar Dicas' : 'Como Colar?'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => {
                    setInputText(SAMPLE_DIET_CUTTING);
                    setShowTips(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.smallBtnText, { color: colors.primary }]}>Exemplo Cutting</Text>
                </TouchableOpacity>
              </View>

              {inputText.length > 0 && (
                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: colors.surfaceBorder }]}
                  onPress={() => setInputText('')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Limpar</Text>
                </TouchableOpacity>
              )}
            </View>

            {showTips && (
              <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>
                  O parser reconhece automaticamente:
                </Text>
                <Text style={[styles.tipLine, { color: colors.textSecondary }]}>
                  • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Metas &amp; Água:</Text> Seg–Sex, Sáb–Dom (kcal, prot, carb, gord) e litros de água por dia.
                </Text>
                <Text style={[styles.tipLine, { color: colors.textSecondary }]}>
                  • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Horários:</Text> Linhas como &quot;09:00 - CAFÉ DA MANHÃ&quot;, &quot;15:30 - ALMOÇO&quot; ou apenas &quot;Almoço&quot;.
                </Text>
                <Text style={[styles.tipLine, { color: colors.textSecondary }]}>
                  • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Opções Selecionáveis:</Text> Blocos como &quot;Proteína (escolher 1 opção):&quot; viram opções tocáveis no dia a dia.
                </Text>
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
              placeholder={'Cole aqui seu plano alimentar...\n\nExemplo:\nPLANO ALIMENTAR - CUTTING\nMeta Seg a Sex: ~2.200 kcal | ~180g Prot\nÁgua: 4 litros/dia\n\n09:00 - CAFÉ DA MANHÃ\n- 3 ovos inteiros\n- 100g cuscuz cozido'}
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleParse}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Analisar Dieta</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <ScrollView contentContainerStyle={styles.previewScroll}>
              {/* Título editável */}
              <View style={[styles.titleEditCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>TÍTULO DO PLANO</Text>
                <TextInput
                  style={[styles.titleInput, { color: colors.textPrimary }]}
                  value={parsedPlan?.title ?? ''}
                  onChangeText={(val) =>
                    setParsedPlan((prev) => (prev ? { ...prev, title: val } : prev))
                  }
                />
              </View>

              {/* Resumo de metas detectadas */}
              {parsedPlan && (
                <View style={[styles.macrosPreviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                  <View style={styles.macroRowTop}>
                    <View style={styles.macroChip}>
                      <Ionicons name="flame-outline" size={14} color={colors.meals} />
                      <Text style={[styles.macroChipText, { color: colors.textPrimary }]}>
                        Seg–Sex: {parsedPlan.weekdayTargets.kcalLabel || '—'}
                      </Text>
                    </View>
                    {parsedPlan.weekdayTargets.proteinLabel && (
                      <View style={styles.macroChip}>
                        <Ionicons name="fitness-outline" size={14} color={colors.protein} />
                        <Text style={[styles.macroChipText, { color: colors.textPrimary }]}>
                          Prot {parsedPlan.weekdayTargets.proteinLabel}
                        </Text>
                      </View>
                    )}
                    <View style={styles.macroChip}>
                      <Ionicons name="water-outline" size={14} color={colors.water} />
                      <Text style={[styles.macroChipText, { color: colors.textPrimary }]}>
                        {(parsedPlan.waterTargetMl / 1000).toFixed(1)}L/dia
                      </Text>
                    </View>
                  </View>

                  {parsedPlan.weekendTargets && (
                    <Text style={[styles.weekendHint, { color: colors.textSecondary }]}>
                      Fim de semana: {parsedPlan.weekendTargets.kcalLabel || ''}{' '}
                      {parsedPlan.weekendTargets.proteinLabel ? `• Prot ${parsedPlan.weekendTargets.proteinLabel}` : ''}
                    </Text>
                  )}

                  {/* Toggle para sincronizar metas */}
                  <TouchableOpacity
                    style={[styles.syncToggleRow, { borderTopColor: colors.surfaceBorder }]}
                    onPress={() => setSyncTargets((v) => !v)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={syncTargets ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={syncTargets ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.syncToggleText, { color: colors.textSecondary }]}>
                      Atualizar metas diárias de água ({(parsedPlan.waterTargetMl / 1000).toFixed(1)}L) e proteína automaticamente
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Lista de Refeições */}
              {parsedPlan?.meals.map((meal) => {
                const totalOptions = meal.optionGroups.reduce((acc, g) => acc + g.options.length, 0);
                return (
                  <View
                    key={meal.id}
                    style={[styles.mealPreviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                  >
                    <View style={styles.mealPreviewHeader}>
                      <View style={styles.mealPreviewTitleRow}>
                        {meal.time && (
                          <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
                            <Text style={[styles.timeBadgeText, { color: colors.primary }]}>{meal.time}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mealPreviewTitle, { color: colors.textPrimary }]}>{meal.title}</Text>
                          {meal.subtitle && (
                            <Text style={[styles.mealPreviewSub, { color: colors.textMuted }]}>{meal.subtitle}</Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveMeal(meal.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={17} color={colors.danger} />
                      </TouchableOpacity>
                    </View>

                    {meal.baseItems.map((item, idx) => (
                      <Text key={idx} style={[styles.previewBullet, { color: colors.textSecondary }]}>
                        • {item}
                      </Text>
                    ))}

                    {totalOptions > 0 && (
                      <View style={[styles.optionsBadge, { backgroundColor: colors.mealsLight }]}>
                        <Ionicons name="options-outline" size={13} color={colors.meals} />
                        <Text style={[styles.optionsBadgeText, { color: colors.meals }]}>
                          {totalOptions} opções selecionáveis detectadas
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {(parsedPlan?.rules.length ?? 0) > 0 && (
                <View style={[styles.rulesPreviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    REGRAS RÁPIDAS ({parsedPlan!.rules.length})
                  </Text>
                  {parsedPlan!.rules.map((r, i) => (
                    <Text key={i} style={[styles.previewBullet, { color: colors.textSecondary }]}>
                      • {r}
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={[styles.footerRow, { borderTopColor: colors.surfaceBorder }]}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.surfaceBorder }]}
                onPress={() => setStep('input')}
                activeOpacity={0.75}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Editar Texto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.success }]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Salvar Plano</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: { flex: 1, padding: 16 },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  tipsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  tipsTitle: { fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  tipLine: { fontSize: 12, lineHeight: 17 },
  textArea: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 13.5,
    lineHeight: 20,
  },
  footer: { paddingTop: 14 },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  previewContainer: { flex: 1 },
  previewScroll: { padding: 16, gap: 12, paddingBottom: 28 },
  titleEditCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  fieldLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 4 },
  titleInput: { fontSize: 16, fontWeight: '800', paddingVertical: 2 },
  macrosPreviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  macroRowTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  macroChipText: { fontSize: 12.5, fontWeight: '700' },
  weekendHint: { fontSize: 12 },
  syncToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: 1,
  },
  syncToggleText: { flex: 1, fontSize: 12, lineHeight: 16 },
  mealPreviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    gap: 5,
  },
  mealPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealPreviewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  timeBadgeText: { fontSize: 12, fontWeight: '800' },
  mealPreviewTitle: { fontSize: 14, fontWeight: '800' },
  mealPreviewSub: { fontSize: 11.5 },
  previewBullet: { fontSize: 12.5, lineHeight: 18 },
  optionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  optionsBadgeText: { fontSize: 11.5, fontWeight: '700' },
  rulesPreviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    gap: 5,
  },
});

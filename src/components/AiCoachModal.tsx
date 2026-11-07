import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import {
  checkBackendHealth,
  fetchAiCoachAnalysis,
  syncLocalWorkoutsToSpringBackend,
  sendAiCoachQuestion,
  getLocalAiCoachChatFallback,
  getBackendBaseUrl,
  setBackendBaseUrl,
  type AiCoachAnalysis,
  type AiCoachChatResponse,
} from '../services/springApiService';
import { getAllWorkoutsWithDetails } from '../database/db';
import { analyzeLocalWorkoutsProgress } from '../utils/progressionCalculator';

interface AiCoachModalProps {
  visible: boolean;
  onClose: () => void;
}

interface QuickPromptChip {
  id: string;
  label: string;
  prompt: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUICK_PROMPT_CHIPS: QuickPromptChip[] = [
  {
    id: 'destravar',
    label: 'Como destravar carga?',
    prompt: 'Como destravar carga e superar o platô atual nos exercícios principais?',
    icon: 'trending-up-outline',
  },
  {
    id: 'descanso',
    label: 'Tempo de descanso',
    prompt: 'Quanto tempo de descanso devo dar entre as séries para hipertrofia e força máxima?',
    icon: 'timer-outline',
  },
  {
    id: 'cadencia',
    label: 'Cadência & Execução',
    prompt: 'Qual é a melhor cadência e velocidade de execução para cada repetição?',
    icon: 'speedometer-outline',
  },
  {
    id: 'deload',
    label: 'Planejar deload',
    prompt: 'Quando e como devo planejar uma semana de deload no meu ciclo de treinos?',
    icon: 'refresh-outline',
  },
  {
    id: 'falha',
    label: 'RPE vs Falha Total',
    prompt: 'Devo ir até a falha concêntrica em todas as séries ou manter RPE entre 8 e 9?',
    icon: 'shield-outline',
  },
  {
    id: 'aquecimento',
    label: 'Aquecimento ideal',
    prompt: 'Como estruturar séries de aquecimento sem queimar a força das séries válidas?',
    icon: 'flame-outline',
  },
];

function getSmartFallbackAnswer(q: string): { answer: string; takeaways: string[] } {
  const lower = q.toLowerCase();

  if (lower.includes('descans') || lower.includes('tempo')) {
    return {
      answer:
        'Para exercícios compostos pesados (supino, agachamento e terra), descanse de 2 a 3 minutos para recuperar a força máxima. Em exercícios isoladores, 60 a 90 segundos são suficientes para manter o rendimento da série.',
      takeaways: [
        'Compostos pesados: 2 a 3 minutos de descanso',
        'Isoladores e acessórios: 60 a 90 segundos',
        'Retome a série com a respiração estável e foco total',
      ],
    };
  }

  if (lower.includes('cadência') || lower.includes('cadencia') || lower.includes('execução') || lower.includes('execucao')) {
    return {
      answer:
        'Mantenha a descida (fase excêntrica) controlada em 2 a 3 segundos e suba com força firme. O controle excêntrico maximiza o estímulo hipertrófico e protege tendões e articulações de rebotes bruscos.',
      takeaways: [
        'Fase excêntrica: 2 a 3 segundos de descida controlada',
        'Fase concêntrica: subida firme sem perder a postura',
        'Evite soltar o peso ou usar rebote articular no final',
      ],
    };
  }

  if (lower.includes('deload') || lower.includes('recupera')) {
    return {
      answer:
        'Se estagnar cargas por 3 treinos consecutivos ou sentir fadiga acumulada, aplique um deload simples: mantenha as cargas atuais, mas reduza 1 série de cada exercício ou reduza o volume total pela metade durante 1 semana.',
      takeaways: [
        'Reduza 1 série por exercício para aliviar a fadiga neuromuscular',
        'Mantenha os pesos para preservar o estímulo de força',
        'Priorize descanso de 2 a 3 minutos entre as séries mantidas',
      ],
    };
  }

  if (lower.includes('falha') || lower.includes('rpe') || lower.includes('rir')) {
    return {
      answer:
        'Evite ir até a falha concêntrica em todas as séries para não sobrecarregar a recuperação. Mantenha RPE entre 8 e 9 (parando com 1 a 2 repetições na reserva), reservando a falha somente para a última série de isoladores.',
      takeaways: [
        'Séries de trabalho em RPE 8-9 (1 a 2 reps na reserva)',
        'Guarde a falha total apenas para a última série de isoladores',
        'Em compostos pesados, pare antes da falha para segurança técnica',
      ],
    };
  }

  if (lower.includes('aqueciment') || lower.includes('queimar')) {
    return {
      answer:
        'Faça 2 a 3 séries curtas de aproximação sem fadiga: 50% da carga para 5 reps, 70% para 3 reps e 85% para 1 repetição de ativação. Descanse 2 minutos e inicie sua série principal com força total.',
      takeaways: [
        'Aproximação progressiva (50% × 5, 70% × 3, 85% × 1)',
        'Zero fadiga: as séries servem apenas para ativar o sistema nervoso',
        'Descanse 2 minutos antes da primeira série pesada de trabalho',
      ],
    };
  }

  const standardFallback = getLocalAiCoachChatFallback();
  return {
    answer: standardFallback.answer,
    takeaways: standardFallback.keyTakeaways,
  };
}

export const AiCoachModal: React.FC<AiCoachModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const { formatWeight, tExercise } = useTranslation();
  const styles = makeStyles(colors, isDark);
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');

  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiCoachAnalysis | null>(null);

  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; takeaways?: string[] }>>([]);

  useEffect(() => {
    if (visible) {
      getBackendBaseUrl().then((url) => {
        setBackendUrl(url);
        setUrlInput(url);
        checkBackendHealth().then((status) => setBackendOnline(status.online));
      });
    }
  }, [visible]);

  useEffect(() => {
    if (activeTab === 'chat' && (chatHistory.length > 0 || chatLoading)) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatHistory, chatLoading, activeTab]);

  const handleTestConnection = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const res = await checkBackendHealth();
    setBackendOnline(res.online);
    Alert.alert(
      res.online ? 'Conexão Estabelecida' : 'Servidor Inacessível',
      res.online
        ? 'A API Spring Boot + PostgreSQL está online e pronta para processar análises!'
        : `Não foi possível conectar em ${backendUrl}. Verifique o túnel ou se o servidor está ativo.`
    );
  };

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    await setBackendBaseUrl(urlInput.trim());
    setBackendUrl(urlInput.trim());
    setShowConfig(false);
    const res = await checkBackendHealth();
    setBackendOnline(res.online);
  };

  const handleRunAnalysis = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoadingAnalysis(true);
    try {
      const localWorkouts = await getAllWorkoutsWithDetails();
      if (localWorkouts.length === 0) {
        Alert.alert('Sem Treinos', 'Você ainda não concluiu nenhum treino para o AI Coach analisar.');
        setLoadingAnalysis(false);
        return;
      }
      if (backendOnline) {
        await syncLocalWorkoutsToSpringBackend(localWorkouts);
      }
      const data = await fetchAiCoachAnalysis();
      setAnalysis(data);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (err: any) {
      try {
        const localWorkouts = await getAllWorkoutsWithDetails();
        const localAnalysis = analyzeLocalWorkoutsProgress(localWorkouts);
        setAnalysis(localAnalysis);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } catch {
        Alert.alert('Erro na Análise', err?.message || 'Não foi possível gerar a análise.');
      }
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSendQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? chatQuestion).trim();
    if (!q || chatLoading) return;

    setChatQuestion('');
    setChatLoading(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      const res: AiCoachChatResponse = await sendAiCoachQuestion(q);
      setChatHistory((prev) => [...prev, { q, a: res.answer, takeaways: res.keyTakeaways }]);
    } catch {
      const fallback = getSmartFallbackAnswer(q);
      setChatHistory((prev) => [
        ...prev,
        {
          q,
          a: fallback.answer,
          takeaways: fallback.takeaways,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChipPress = (prompt: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    handleSendQuestion(prompt);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Compacto de Produto */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="sparkles" size={17} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Coach</Text>
              <Text style={styles.headerSubtitle}>Análise determinística & consultoria de treino</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowConfig((prev) => !prev)}
              style={styles.statusPill}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: backendOnline ? colors.success : '#F59E0B' },
                ]}
              />
              <Text style={styles.statusPillText}>{backendOnline ? 'Cloud' : 'Local'}</Text>
              <Ionicons name="options-outline" size={13} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Barra retrátil de configuração do servidor */}
        {showConfig && (
          <View style={styles.configDrawer}>
            <Text style={styles.configDrawerTitle}>Configuração da API Spring Boot</Text>
            <View style={styles.configInputRow}>
              <TextInput
                style={styles.configInput}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://sua-api.onrender.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={handleSaveUrl} style={styles.configSaveBtn} activeOpacity={0.8}>
                <Text style={styles.configSaveBtnText}>Salvar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTestConnection} style={styles.configTestBtn} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Segmented Control de Abas */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('chat');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={16}
              color={activeTab === 'chat' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
              Assistente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'analysis' && styles.tabItemActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('analysis');
              if (!analysis) {
                handleRunAnalysis();
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'analysis' ? 'analytics' : 'analytics-outline'}
              size={16}
              color={activeTab === 'analysis' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'analysis' && styles.tabTextActive]}>
              Diagnóstico 1RM
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo da Aba 1: Chat Nativo em Tela Cheia */}
        {activeTab === 'chat' ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {chatHistory.length === 0 ? (
                <View style={styles.emptyChatContainer}>
                  <View style={styles.emptyChatIconCircle}>
                    <Ionicons name="sparkles-outline" size={30} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyChatTitle}>Como posso otimizar seu treino hoje?</Text>
                  <Text style={styles.emptyChatSub}>
                    Pergunte sobre quebra de platôs, deload, cadência e descansos ideais.
                  </Text>

                  <View style={styles.emptyGridContainer}>
                    {QUICK_PROMPT_CHIPS.map((chip) => (
                      <TouchableOpacity
                        key={chip.id}
                        style={styles.emptyGridCard}
                        onPress={() => handleChipPress(chip.prompt)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={chip.icon} size={18} color={colors.primary} style={{ marginBottom: 4 }} />
                        <Text style={styles.emptyGridCardText}>{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                chatHistory.map((item, idx) => (
                  <View key={idx} style={styles.bubbleRow}>
                    {/* Mensagem do Usuário */}
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{item.q}</Text>
                    </View>

                    {/* Resposta do Coach */}
                    <View style={styles.aiBubble}>
                      <View style={styles.aiBubbleHeader}>
                        <Ionicons name="sparkles" size={13} color={colors.primary} />
                        <Text style={styles.aiBubbleAuthor}>FocusLift Coach</Text>
                      </View>
                      <Text style={styles.aiBubbleText}>{item.a}</Text>

                      {item.takeaways && item.takeaways.length > 0 && (
                        <View style={styles.takeawaysBox}>
                          {item.takeaways.map((t, tIdx) => (
                            <View key={tIdx} style={styles.takeawayRow}>
                              <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginTop: 2 }} />
                              <Text style={styles.takeawayText}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}

              {chatLoading && (
                <View style={styles.aiLoadingBubble}>
                  <View style={styles.aiBubbleHeader}>
                    <Ionicons name="sparkles" size={13} color={colors.primary} />
                    <Text style={styles.aiBubbleAuthor}>FocusLift Coach</Text>
                  </View>
                  <View style={styles.loadingInnerRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingInnerText}>Analisando treino e biomecânica...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Chips Rápidos Horizontais (quando já há mensagens) */}
            {chatHistory.length > 0 && (
              <View style={styles.horizontalChipsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChipsScroll}>
                  {QUICK_PROMPT_CHIPS.map((chip) => (
                    <TouchableOpacity
                      key={chip.id}
                      style={styles.chipPill}
                      onPress={() => handleChipPress(chip.prompt)}
                      disabled={chatLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={chip.icon} size={13} color={colors.textSecondary} />
                      <Text style={styles.chipPillText}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Rodapé Fixo de Input */}
            <View style={styles.chatFooter}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.chatInput}
                  value={chatQuestion}
                  onChangeText={setChatQuestion}
                  placeholder="Pergunte sobre cargas, deload, descanso..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={400}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!chatQuestion.trim() || chatLoading) && styles.sendBtnDisabled]}
                  onPress={() => handleSendQuestion()}
                  disabled={!chatQuestion.trim() || chatLoading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* Conteúdo da Aba 2: Dashboard Analítico */
          <ScrollView style={styles.analysisScroll} contentContainerStyle={styles.analysisScrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={handleRunAnalysis}
              disabled={loadingAnalysis}
              activeOpacity={0.85}
            >
              {loadingAnalysis ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>
                    {analysis ? 'Atualizar Diagnóstico' : 'Gerar Diagnóstico da Minha Evolução'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {analysis && (
              <View style={styles.analysisResults}>
                {/* Card Volume Semanal */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
                      <Text style={styles.metricCardTitle}>Volume Semanal (Tonnage)</Text>
                    </View>
                    <View style={styles.deltaBadge}>
                      <Text style={[styles.deltaBadgeText, { color: analysis.volumeDeltaPercent >= 3 ? colors.success : colors.textPrimary }]}>
                        {analysis.volumeDeltaPercent > 0 ? '+' : ''}{analysis.volumeDeltaPercent}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.volumeNumbersRow}>
                    <View style={styles.volumeBox}>
                      <Text style={styles.volumeBoxLabel}>Semana Atual</Text>
                      <Text style={styles.volumeBoxValue}>{formatWeight(analysis.currentWeekVolumeKg)}</Text>
                    </View>
                    <View style={styles.volumeBoxDivider} />
                    <View style={styles.volumeBox}>
                      <Text style={styles.volumeBoxLabel}>Semana Anterior</Text>
                      <Text style={styles.volumeBoxValue}>{formatWeight(analysis.previousWeekVolumeKg)}</Text>
                    </View>
                  </View>
                </View>

                {/* Card Top Progressões */}
                {analysis.topProgressions && analysis.topProgressions.length > 0 && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={styles.metricTitleGroup}>
                        <Ionicons name="trophy-outline" size={16} color={colors.streak} />
                        <Text style={styles.metricCardTitle}>Evoluções de Força (1RM Brzycki)</Text>
                      </View>
                    </View>
                    {analysis.topProgressions.map((p, idx) => (
                      <View key={p.exerciseName || idx} style={styles.progressionItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.progressionExerciseName} numberOfLines={1}>
                            {tExercise(p.exerciseName)}
                          </Text>
                          <Text style={styles.progressionSetDetail}>
                            Melhor série: {p.currentTopWeight}kg × {p.currentTopReps} reps
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.progression1RMText}>1RM ~{formatWeight(p.current1Rm)}</Text>
                          {p.delta1RmKg > 0 && (
                            <Text style={styles.progressionDeltaText}>
                              +{p.delta1RmKg}kg (+{p.delta1RmPercent}%)
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Card Platôs */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons
                        name={analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? colors.danger : colors.success}
                      />
                      <Text style={styles.metricCardTitle}>Detecção de Platôs</Text>
                    </View>
                  </View>
                  {analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? (
                    analysis.detectedPlateaus.map((plat, idx) => (
                      <View key={plat.exerciseName || idx} style={styles.plateauBox}>
                        <Text style={styles.plateauExerciseTitle}>
                          {plat.exerciseName} {plat.routineTitle ? `(${plat.routineTitle})` : ''}
                        </Text>
                        <Text style={styles.plateauDesc}>
                          Estagnado há {plat.consecutiveStagnantSessions} sessões em {plat.currentWeight}kg × {plat.currentReps} reps (RPE médio {plat.averageRpe})
                        </Text>
                        <View style={styles.plateauActionBox}>
                          <Text style={styles.plateauActionLabel}>Ação Recomendada:</Text>
                          <Text style={styles.plateauActionText}>{plat.suggestedAction}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.cleanStatusBox}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.cleanStatusText}>
                        Nenhum platô detectado. Suas cargas continuam progredindo de forma consistente.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Parecer do Coach */}
                <View style={[styles.metricCard, styles.aiSummaryCard]}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons name="compass-outline" size={16} color={colors.primary} />
                      <Text style={[styles.metricCardTitle, { color: colors.primary }]}>Parecer Tático</Text>
                    </View>
                  </View>
                  <Text style={styles.aiSummaryBody}>{analysis.aiSummary}</Text>

                  {analysis.nextSessionFocus ? (
                    <View style={styles.focusBanner}>
                      <Text style={styles.focusBannerLabel}>FOCO DA PRÓXIMA SESSÃO</Text>
                      <Text style={styles.focusBannerText}>{analysis.nextSessionFocus}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 14,
      gap: 5,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    configDrawer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    configDrawerTitle: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    configInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    configInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 12,
      color: colors.textPrimary,
    },
    configSaveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    configSaveBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    configTestBtn: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      width: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 12,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    chatScroll: {
      flex: 1,
    },
    chatScrollContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 12,
    },
    emptyChatContainer: {
      alignItems: 'center',
      paddingTop: 28,
      paddingHorizontal: 12,
    },
    emptyChatIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    emptyChatTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    emptyChatSub: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 24,
    },
    emptyGridContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    emptyGridCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      padding: 12,
    },
    emptyGridCardText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 16,
    },
    bubbleRow: {
      gap: 10,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      maxWidth: '85%',
    },
    userBubbleText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
      lineHeight: 18,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      maxWidth: '92%',
      gap: 8,
    },
    aiBubbleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    aiBubbleAuthor: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    aiBubbleText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    takeawaysBox: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      gap: 6,
    },
    takeawayRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    takeawayText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    aiLoadingBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 12,
      borderRadius: 14,
      gap: 6,
    },
    loadingInnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    loadingInnerText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    horizontalChipsContainer: {
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    horizontalChipsScroll: {
      paddingHorizontal: 12,
      gap: 8,
    },
    chipPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    chipPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chatFooter: {
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 22,
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 4,
    },
    chatInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      maxHeight: 80,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.35,
    },
    analysisScroll: {
      flex: 1,
    },
    analysisScrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    actionBtnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    actionBtnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 13.5,
      fontWeight: '800',
    },
    analysisResults: {
      gap: 14,
    },
    metricCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    aiSummaryCard: {
      borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(109, 40, 217, 0.3)',
    },
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metricTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metricCardTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    deltaBadge: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    deltaBadgeText: {
      fontSize: 11.5,
      fontWeight: '800',
    },
    volumeNumbersRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
    },
    volumeBox: {
      flex: 1,
      alignItems: 'center',
    },
    volumeBoxLabel: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    volumeBoxValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    volumeBoxDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.surfaceBorder,
    },
    progressionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    progressionExerciseName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    progressionSetDetail: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    progression1RMText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    progressionDeltaText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.success,
    },
    plateauBox: {
      backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(225, 29, 72, 0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(225, 29, 72, 0.18)',
      borderRadius: 12,
      padding: 12,
      gap: 5,
    },
    plateauExerciseTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.danger,
    },
    plateauDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    plateauActionBox: {
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    plateauActionLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    plateauActionText: {
      fontSize: 11,
      color: colors.textPrimary,
      lineHeight: 15,
    },
    cleanStatusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 150, 105, 0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.18)',
      borderRadius: 10,
      padding: 10,
    },
    cleanStatusText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.success,
      lineHeight: 16,
      fontWeight: '600',
    },
    aiSummaryBody: {
      fontSize: 12.5,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    focusBanner: {
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(109, 40, 217, 0.08)',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: 10,
      borderRadius: 8,
      gap: 2,
    },
    focusBannerLabel: {
      fontSize: 9.5,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    focusBannerText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}

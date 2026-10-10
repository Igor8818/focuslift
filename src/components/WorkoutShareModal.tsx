/**
 * WorkoutShareModal.tsx
 *
 * Modal premium de compartilhamento e Story Card para treinos finalizados do FocusLift.
 * Suporta compartilhamento nativo via Share API do React Native (WhatsApp, Instagram Stories, Telegram, etc.)
 * e exibe um card visual de alta fidelidade com volume, séries, PRs quebrados e duração.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';

export interface BrokenPRItem {
  exerciseName: string;
  weight: number;
  reps: number;
}

export interface WorkoutShareData {
  title: string;
  date?: string;
  duration?: string;
  totalVolume: number;
  totalSets: number;
  brokenPRs?: BrokenPRItem[];
  exerciseNames?: string[];
}

export interface WorkoutShareModalProps {
  visible: boolean;
  onClose: () => void;
  data: WorkoutShareData | null;
}

const MOTIVATIONAL_QUOTES = [
  'A consistência vence a intensidade todos os dias.',
  'Sobrecarga progressiva: um tijolo de cada vez.',
  'Mais forte que ontem, construindo o amanhã.',
  'Disciplina é fazer quando a motivação não aparece.',
  'O ferro nunca mente. Parabéns pelo treino!',
];

export const WorkoutShareModal: React.FC<WorkoutShareModalProps> = ({
  visible,
  onClose,
  data,
}) => {
  const { colors, isDark } = useTheme();
  const { t, tExercise, formatWeight, language } = useTranslation();
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  if (!data) return null;

  const quote = MOTIVATIONAL_QUOTES[Math.abs(data.title.length + data.totalSets) % MOTIVATIONAL_QUOTES.length];

  const formattedDate = data.date
    ? new Date(data.date.includes('T') ? data.date : `${data.date}T12:00:00`).toLocaleDateString(
        language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'pt-BR',
        { weekday: 'short', day: 'numeric', month: 'short' }
      )
    : new Date().toLocaleDateString(
        language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'pt-BR',
        { weekday: 'short', day: 'numeric', month: 'short' }
      );

  const buildShareText = (): string => {
    let msg = `⚡ FocusLift | Treino Concluído!\n`;
    msg += `🏋️ ${data.title}\n`;
    msg += `📅 ${formattedDate}\n`;
    if (data.duration) {
      msg += `⏱️ Duração: ${data.duration}\n`;
    }
    msg += `📦 Volume Total: ${formatWeight(data.totalVolume)}\n`;
    msg += `🔥 Séries Totais: ${data.totalSets}\n`;

    if (data.brokenPRs && data.brokenPRs.length > 0) {
      msg += `\n🏆 NOVOS RECORDES PESSOAIS:\n`;
      data.brokenPRs.forEach((pr) => {
        msg += `• ${tExercise(pr.exerciseName)}: ${formatWeight(pr.weight)} × ${pr.reps} reps 💥\n`;
      });
    }

    if (data.exerciseNames && data.exerciseNames.length > 0) {
      msg += `\n📋 Exercícios:\n`;
      data.exerciseNames.slice(0, 6).forEach((name) => {
        msg += `• ${tExercise(name)}\n`;
      });
      if (data.exerciseNames.length > 6) {
        msg += `• +${data.exerciseNames.length - 6} outros...\n`;
      }
    }

    msg += `\n"${quote}"\n`;
    msg += `#FocusLift #SobrecargaProgressiva #Treino`;
    return msg;
  };

  const handleNativeShare = async () => {
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      const message = buildShareText();
      const result = await Share.share(
        {
          title: `FocusLift - ${data.title}`,
          message,
        },
        {
          dialogTitle: `Compartilhar Treino - ${data.title}`,
        }
      );

      if (result.action === Share.sharedAction) {
        setCopiedFeedback(true);
        setTimeout(() => setCopiedFeedback(false), 2500);
      }
    } catch (err) {
      console.warn('Erro ao compartilhar treino:', err);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header com Fechar */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Text style={styles.brandBadge}>⚡ FOCUSLIFT</Text>
              <Text style={styles.storyCardTag}>STORY CARD</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* ── CARD VISUAL PRINCIPAL (Preview estilo Story) ── */}
            <View style={styles.cardPreview}>
              {/* Glow decorativo no topo */}
              <View style={styles.glowCorner} />

              <View style={styles.cardHeader}>
                <View style={styles.appIconBadge}>
                  <Text style={styles.appIconText}>🏋️‍♂️</Text>
                </View>
                <View style={styles.cardHeaderTexts}>
                  <Text style={styles.workoutName} numberOfLines={2}>
                    {data.title}
                  </Text>
                  <Text style={styles.workoutDate}>{formattedDate}</Text>
                </View>
              </View>

              {/* Grid com 3 métricas de impacto */}
              <View style={styles.metricsRow}>
                {data.duration ? (
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>⏱️</Text>
                    <Text style={styles.metricValue}>{data.duration}</Text>
                    <Text style={styles.metricLabel}>{t('workoutSession.timeLabel')}</Text>
                  </View>
                ) : null}

                <View style={styles.metricBox}>
                  <Text style={styles.metricIcon}>📦</Text>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {formatWeight(data.totalVolume)}
                  </Text>
                  <Text style={styles.metricLabel}>{t('workoutSession.volumeLabel')}</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricIcon}>🔥</Text>
                  <Text style={styles.metricValue}>{data.totalSets}</Text>
                  <Text style={styles.metricLabel}>{t('workoutSession.setsLabel')}</Text>
                </View>
              </View>

              {/* Seção de Novos Recordes Batidos */}
              {data.brokenPRs && data.brokenPRs.length > 0 && (
                <View style={styles.prBox}>
                  <View style={styles.prHeader}>
                    <Text style={styles.prTrophy}>🏆</Text>
                    <Text style={styles.prTitle}>
                      {data.brokenPRs.length} {data.brokenPRs.length > 1 ? 'RECORDES BATIDOS!' : 'RECORDE BATIDO!'}
                    </Text>
                  </View>
                  {data.brokenPRs.map((pr, idx) => (
                    <View key={idx} style={styles.prItem}>
                      <Text style={styles.prExerciseName} numberOfLines={1}>
                        {tExercise(pr.exerciseName)}
                      </Text>
                      <Text style={styles.prScore}>
                        {formatWeight(pr.weight)} × {pr.reps} reps
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Lista dos principais exercícios realizados */}
              {data.exerciseNames && data.exerciseNames.length > 0 && (
                <View style={styles.exercisesListContainer}>
                  <Text style={styles.exercisesListTitle}>EXERCÍCIOS CONCLUÍDOS</Text>
                  <View style={styles.chipsWrap}>
                    {data.exerciseNames.map((name, i) => (
                      <View key={i} style={styles.exerciseChip}>
                        <Text style={styles.exerciseChipText} numberOfLines={1}>
                          {tExercise(name)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Citação Motivacional no rodapé do Card */}
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>"{quote}"</Text>
              </View>
            </View>
          </ScrollView>

          {/* ── BOTÕES DE AÇÃO FIXOS NO RODAPÉ ── */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleNativeShare}
              activeOpacity={0.85}
            >
              <Text style={styles.shareButtonText}>
                {copiedFeedback ? '✓ Compartilhado!' : '📤 Compartilhar Treino'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissButton} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.dismissButtonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    container: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '92%',
      backgroundColor: isDark ? '#111622' : '#FFFFFF',
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 12,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    brandBadge: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 1.2,
    },
    storyCardTag: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    scrollArea: {
      maxHeight: 520,
    },
    cardPreview: {
      backgroundColor: isDark ? '#171E2E' : '#F8FAFC',
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.3)',
      overflow: 'hidden',
      position: 'relative',
    },
    glowCorner: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
      opacity: isDark ? 0.15 : 0.08,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },
    appIconBadge: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
    },
    appIconText: {
      fontSize: 22,
    },
    cardHeaderTexts: {
      flex: 1,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    workoutDate: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    metricsRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(10, 13, 20, 0.6)' : '#FFFFFF',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 10,
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      marginBottom: 16,
    },
    metricBox: {
      alignItems: 'center',
      flex: 1,
    },
    metricIcon: {
      fontSize: 16,
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    prBox: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      marginBottom: 16,
    },
    prHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    prTrophy: {
      fontSize: 16,
    },
    prTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: '#F59E0B',
      letterSpacing: 0.8,
    },
    prItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    prExerciseName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    prScore: {
      fontSize: 12,
      fontWeight: '800',
      color: '#F59E0B',
    },
    exercisesListContainer: {
      marginBottom: 14,
    },
    exercisesListTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 8,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    exerciseChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    exerciseChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    quoteBox: {
      marginTop: 6,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
    },
    quoteText: {
      fontSize: 11,
      fontStyle: 'italic',
      color: colors.textMuted,
      textAlign: 'center',
    },
    footerActions: {
      marginTop: 16,
      gap: 10,
    },
    shareButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    shareButtonText: {
      color: '#0A0D14',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    dismissButton: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}

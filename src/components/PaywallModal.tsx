/**
 * PaywallModal.tsx
 *
 * Modal de apresentação e checkout do FocusLift PRO.
 * Design de alta conversão inspirado em apps referências de fitness (Hevy, WHOOP, RP Hypertrophy).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useSubscription, type SubscriptionPlan } from '../contexts/SubscriptionContext';

export interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  titleTrigger?: string;
}

const PRO_BENEFITS = [
  {
    icon: '⚡',
    title: 'Fichas & Rotinas Ilimitadas',
    desc: 'Crie e importe quantas divisões e treinos quiser (sem o limite gratuito de 3).',
  },
  {
    icon: '☁️',
    title: 'Backup Automático & Restauração na Nuvem',
    desc: 'Seus treinos, séries e recordes salvos na nuvem e restauráveis em qualquer celular.',
  },
  {
    icon: '📈',
    title: 'Gráficos de Volume, 1RM & Peso Corporal',
    desc: 'Métricas completas de evolução por exercício, grupo muscular e hall de recordes.',
  },
  {
    icon: '🧮',
    title: 'Calculadora Visual de Anilhas & 1RM',
    desc: 'Monte a barra sem erro de cálculo e descubra suas cargas ideais por repetição.',
  },
  {
    icon: '📊',
    title: 'Exportação & Importação em Planilha (CSV)',
    desc: 'Exporte todo o seu histórico para Excel/Sheets ou importe treinos rapidamente.',
  },
  {
    icon: '👑',
    title: 'Story Cards Dourados & Badges PRO',
    desc: 'Designs premium exclusivos para compartilhar seus recordes nas redes sociais.',
  },
];

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  titleTrigger,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { plans, subscribe, restorePurchases } = useSubscription();

  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlan>('annual');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlan = (planId: SubscriptionPlan) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedPlanId(planId);
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      const success = await subscribe(selectedPlanId);
      if (success) {
        Alert.alert(
          'Bem-vindo ao FocusLift PRO! 👑',
          'Sua assinatura foi ativada com sucesso. Todos os recursos ilimitados estão desbloqueados.',
          [{ text: 'Bora Treinar! 💪', onPress: onClose }]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível processar a assinatura. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro na assinatura:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Sucesso', 'Assinatura restaurada com sucesso!', [{ text: 'OK', onPress: onClose }]);
      } else {
        Alert.alert('Nenhuma compra encontrada', 'Não encontramos uma assinatura ativa vinculada.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header com fechar */}
          <View style={styles.topBar}>
            <View style={styles.badgePro}>
              <Text style={styles.badgeProText}>👑 FOCUSLIFT PRO</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Título de Impacto */}
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>
                {titleTrigger || 'Desbloqueie todo o seu potencial'}
              </Text>
              <Text style={styles.heroSubtitle}>
                Evolua com sobrecarga progressiva inteligente, dados sem limites e respaldo profissional.
              </Text>
            </View>

            {/* Grid de Benefícios */}
            <View style={styles.benefitsContainer}>
              {PRO_BENEFITS.map((b, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <View style={styles.benefitIconCircle}>
                    <Text style={styles.benefitIconText}>{b.icon}</Text>
                  </View>
                  <View style={styles.benefitTexts}>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitDesc}>{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Seleção de Planos */}
            <Text style={styles.selectPlanLabel}>ESCOLHA SEU PLANO</Text>
            <View style={styles.plansContainer}>
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                    onPress={() => handleSelectPlan(p.id)}
                    activeOpacity={0.85}
                  >
                    {/* Badge do plano */}
                    {p.badge ? (
                      <View style={[styles.planBadge, isSelected ? styles.planBadgeActive : null]}>
                        <Text style={styles.planBadgeText}>{p.badge}</Text>
                      </View>
                    ) : null}

                    <View style={styles.planCardLeft}>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <View>
                        <Text style={styles.planName}>{p.name}</Text>
                        {p.monthlyEquivalent ? (
                          <Text style={styles.monthlyEquivalent}>{p.monthlyEquivalent}</Text>
                        ) : (
                          <Text style={styles.monthlyEquivalent}>{p.savings || p.billingPeriod}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.planPriceGroup}>
                      <Text style={[styles.planPrice, isSelected && styles.planPriceActive]}>
                        {p.priceFormatted}
                      </Text>
                      <Text style={styles.planPeriod}>{p.billingPeriod}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.guaranteeText}>
              🛡️ Cancele a qualquer momento no seu celular. Sem pegadinhas.
            </Text>
          </ScrollView>

          {/* Rodapé Fixo */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.subscribeBtn, isProcessing && styles.subscribeBtnDisabled]}
              onPress={handleSubscribe}
              disabled={isProcessing}
              activeOpacity={0.88}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.subscribeBtnText}>
                  ATIVAR FOCUSLIFT PRO 👑
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={handleRestore}>
                <Text style={styles.footerLinkText}>Restaurar Compras</Text>
              </TouchableOpacity>
              <Text style={styles.footerLinkDivider}>•</Text>
              <TouchableOpacity onPress={() => Alert.alert('Termos', 'Ao assinar, o valor é processado com segurança via App Store / Google Play.')}>
                <Text style={styles.footerLinkText}>Termos de Uso</Text>
              </TouchableOpacity>
            </View>
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
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDark ? '#0D111A' : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '92%',
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 24,
      borderTopWidth: 1.5,
      borderTopColor: 'rgba(245, 158, 11, 0.4)',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    badgePro: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.5)',
    },
    badgeProText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#F59E0B',
      letterSpacing: 1,
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
    scrollContent: {
      maxHeight: 520,
    },
    heroSection: {
      marginTop: 4,
      marginBottom: 18,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      lineHeight: 28,
    },
    heroSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      lineHeight: 18,
    },
    benefitsContainer: {
      gap: 12,
      marginBottom: 22,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    benefitIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    benefitIconText: {
      fontSize: 16,
    },
    benefitTexts: {
      flex: 1,
    },
    benefitTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    benefitDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 15,
    },
    selectPlanLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 10,
    },
    plansContainer: {
      gap: 10,
      marginBottom: 14,
    },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#141A28' : '#F8FAFC',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      position: 'relative',
    },
    planCardSelected: {
      borderColor: '#F59E0B',
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FEF3C7',
    },
    planBadge: {
      position: 'absolute',
      top: -10,
      right: 14,
      backgroundColor: '#F59E0B',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    planBadgeActive: {
      backgroundColor: '#D97706',
    },
    planBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    planCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleActive: {
      borderColor: '#F59E0B',
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#F59E0B',
    },
    planName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    monthlyEquivalent: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '600',
    },
    planPriceGroup: {
      alignItems: 'flex-end',
    },
    planPrice: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    planPriceActive: {
      color: isDark ? '#F59E0B' : '#B45309',
    },
    planPeriod: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
    },
    guaranteeText: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 10,
    },
    footer: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      gap: 10,
    },
    subscribeBtn: {
      backgroundColor: '#F59E0B',
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 5,
    },
    subscribeBtnDisabled: {
      opacity: 0.6,
    },
    subscribeBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    footerLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    footerLinkText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    footerLinkDivider: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}

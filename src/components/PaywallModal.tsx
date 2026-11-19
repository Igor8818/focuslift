import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useSubscription, FREE_ROUTINE_LIMIT } from '../contexts/SubscriptionContext';

export const PaywallModal: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { language } = useTranslation();
  const {
    paywallVisible,
    paywallReason,
    closePaywall,
    plans,
    subscribe,
    restorePurchases,
    isPaymentConfigured,
  } = useSubscription();

  const [selectedId, setSelectedId] = useState<'annual' | 'monthly'>('annual');
  const [submitting, setSubmitting] = useState(false);

  const isPt = language === 'pt';
  const styles = makeStyles(colors, isDark);

  const getContextSubtitle = () => {
    if (paywallReason === 'ai_coach') {
      return isPt
        ? 'Seus créditos gratuitos do AI Coach acabaram. Desbloqueie consultoria ilimitada com 7 dias grátis.'
        : 'Your free AI Coach credits are used up. Unlock unlimited coaching with a 7-day free trial.';
    }
    if (paywallReason === 'routines') {
      return isPt
        ? `O plano gratuito permite até ${FREE_ROUTINE_LIMIT} fichas. Assine o PRO para criar fichas ilimitadas e usar o AI Coach.`
        : `Free plan includes up to ${FREE_ROUTINE_LIMIT} routines. Upgrade to PRO for unlimited routines & AI Coach.`;
    }
    return isPt
      ? 'Treine com inteligência científica: IA sem limites, prevenção de lesões ACWR e backup em nuvem.'
      : 'Train smarter with science: unlimited AI Coach, ACWR injury prevention, and automatic cloud sync.';
  };

  const benefits: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }> = isPt
    ? [
        {
          icon: 'sparkles-outline',
          title: 'AI Coach 2.0 Ilimitado',
          desc: 'Memória de conversa, gerador de fichas em 1 toque e substituição de máquinas ao vivo.',
        },
        {
          icon: 'shield-checkmark-outline',
          title: 'Ciência ACWR & Detecção de Platô',
          desc: 'Controle fadiga aguda vs crônica e receba alertas automáticos de deload e micro-carga.',
        },
        {
          icon: 'barbell-outline',
          title: 'Fichas de Treino Ilimitadas',
          desc: 'Monte quantos ciclos, splits e variações precisar sem travas.',
        },
        {
          icon: 'cloud-done-outline',
          title: 'Backup em Nuvem Automático',
          desc: 'Sincronize treinos e recordes pessoais com segurança para nunca perder seu histórico.',
        },
      ]
    : [
        {
          icon: 'sparkles-outline',
          title: 'Unlimited AI Coach 2.0',
          desc: 'Multi-turn memory, 1-tap routine builder, and live exercise swaps mid-workout.',
        },
        {
          icon: 'shield-checkmark-outline',
          title: 'ACWR Fatigue Science & Plateau Alerts',
          desc: 'Track acute vs chronic workload and get automatic deload or micro-loading cues.',
        },
        {
          icon: 'barbell-outline',
          title: 'Unlimited Workout Routines',
          desc: 'Build as many splits, phases, and custom programs as you need.',
        },
        {
          icon: 'cloud-done-outline',
          title: 'Automatic Cloud Backup',
          desc: 'Sync workouts, routines, and PRs across devices seamlessly.',
        },
      ];

  const handleSubscribe = async () => {
    setSubmitting(true);
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      const ok = await subscribe(selectedId);
      if (ok) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        closePaywall();
        Alert.alert(
          isPt ? 'FocusLift PRO Ativado!' : 'FocusLift PRO Activated!',
          isPaymentConfigured
            ? isPt
              ? 'Sua assinatura PRO com 7 dias grátis foi ativada com sucesso.'
              : 'Your PRO subscription with a 7-day free trial is now active.'
            : isPt
            ? 'Modo preview local ativado (RevenueCat ainda não vinculado neste build). Todos os recursos PRO foram desbloqueados para testes!'
            : 'Local preview mode enabled (RevenueCat keys not configured in this build). All PRO features unlocked for testing!'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      closePaywall();
      Alert.alert(
        isPt ? 'Compras Restauradas' : 'Purchases Restored',
        isPt ? 'Seu acesso FocusLift PRO foi restaurado.' : 'Your FocusLift PRO access has been restored.'
      );
    } else {
      Alert.alert(
        isPt ? 'Nenhuma Assinatura Encontrada' : 'No Subscription Found',
        isPt
          ? 'Não encontramos uma assinatura ativa vinculada a este dispositivo.'
          : 'No active subscription was found for this device.'
      );
    }
  };

  return (
    <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePaywall}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.proPill}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.proPillText}>FOCUSLIFT PRO</Text>
          </View>
          <TouchableOpacity onPress={closePaywall} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.heroTitle}>
            {isPt ? 'Evolua mais rápido com ciência e IA.' : 'Progress faster with science & AI.'}
          </Text>
          <Text style={styles.heroSub}>{getContextSubtitle()}</Text>

          {/* Benefícios */}
          <View style={styles.benefitsCard}>
            {benefits.map((b, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <View style={styles.benefitIconBox}>
                  <Ionicons name={b.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Seleção de Planos */}
          <View style={styles.plansContainer}>
            {plans.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setSelectedId(p.id);
                  }}
                  activeOpacity={0.85}
                >
                  {p.badge && (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{p.badge}</Text>
                    </View>
                  )}
                  <View style={styles.planRow}>
                    <View style={styles.radioOuter}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{p.name}</Text>
                      <Text style={styles.planBilling}>{p.billingPeriod}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.planPrice}>{p.priceFormatted}</Text>
                      {p.id === 'annual' && (
                        <Text style={styles.planEquivalent}>{p.monthlyEquivalent}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSubscribe}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.ctaBtnText}>
                {isPt ? 'Iniciar 7 Dias Grátis' : 'Start 7-Day Free Trial'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legalNote}>
            {isPt
              ? 'Cancele a qualquer momento antes do fim dos 7 dias grátis sem cobranças.'
              : 'Cancel anytime before the 7-day trial ends with zero charges.'}
          </Text>

          <View style={styles.secondaryActions}>
            <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                {isPt ? 'Restaurar Compras' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.dotSep}>•</Text>
            <TouchableOpacity onPress={closePaywall} activeOpacity={0.7} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                {isPt ? 'Continuar no Plano Grátis' : 'Continue Free Plan'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
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
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    proPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    proPillText: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 0.8,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 36,
      gap: 18,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    heroSub: {
      fontSize: 13.5,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: -8,
    },
    benefitsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    benefitIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitTitle: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    benefitDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginTop: 2,
    },
    plansContainer: {
      gap: 12,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      padding: 16,
      position: 'relative',
    },
    planCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.10)' : 'rgba(109, 40, 217, 0.06)',
    },
    planBadge: {
      position: 'absolute',
      top: -10,
      right: 14,
      backgroundColor: colors.primary,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
    },
    planBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    planName: {
      fontSize: 14.5,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    planBilling: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    planPrice: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    planEquivalent: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
      marginTop: 2,
    },
    ctaBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    ctaBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    legalNote: {
      fontSize: 11.5,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: -6,
    },
    secondaryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 2,
    },
    secondaryBtn: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    secondaryBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    dotSep: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}

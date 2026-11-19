/**
 * SubscriptionContext.tsx
 *
 * Gerenciamento Freemium / FocusLift PRO com preços localizados (BRL / Global USD),
 * persistência em AsyncStorage e suporte futuro a RevenueCat via EXPO_PUBLIC_REVENUECAT_*_KEY.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Language } from '../i18n/translations';
import { useTranslation } from './LanguageContext';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual' | 'lifetime';

export interface PlanDetails {
  id: Exclude<SubscriptionPlan, 'free' | 'lifetime'>;
  name: string;
  priceFormatted: string;
  monthlyEquivalent: string;
  billingPeriod: string;
  badge?: string;
}

export const FREE_ROUTINE_LIMIT = 3;
export const FREE_AI_TRIAL_LIMIT = 3;

const STORAGE_PLAN_KEY = '@focuslift_subscription_plan';
const STORAGE_FREE_AI_USES_KEY = '@focuslift_free_ai_uses';

export function getLocalizedPlans(language: Language): PlanDetails[] {
  if (language === 'pt') {
    return [
      {
        id: 'annual',
        name: 'FocusLift PRO Anual',
        priceFormatted: 'R$ 119,90/ano',
        monthlyEquivalent: 'R$ 9,99/mês',
        billingPeriod: 'Cobrado anualmente • 7 dias grátis',
        badge: 'MAIS POPULAR (-33%)',
      },
      {
        id: 'monthly',
        name: 'FocusLift PRO Mensal',
        priceFormatted: 'R$ 14,90/mês',
        monthlyEquivalent: 'R$ 14,90/mês',
        billingPeriod: 'Cobrado mensalmente • Cancele quando quiser',
      },
    ];
  }

  return [
    {
      id: 'annual',
      name: 'FocusLift PRO Annual',
      priceFormatted: '$39.99/yr',
      monthlyEquivalent: '$3.33/mo',
      billingPeriod: 'Billed annually • 7-day free trial',
      badge: 'BEST VALUE (-33%)',
    },
    {
      id: 'monthly',
      name: 'FocusLift PRO Monthly',
      priceFormatted: '$4.99/mo',
      monthlyEquivalent: '$4.99/mo',
      billingPeriod: 'Billed monthly • Cancel anytime',
    },
  ];
}

export interface SubscriptionContextType {
  isPro: boolean;
  plan: SubscriptionPlan;
  isLoading: boolean;
  isPaymentConfigured: boolean;
  canCreateRoutine: (currentRoutineCount: number, additionalCount?: number) => boolean;
  remainingFreeRoutines: (currentRoutineCount: number) => number;
  freeAiUsesRemaining: number;
  canUseAiCoach: boolean;
  consumeFreeAiUse: () => Promise<void>;
  paywallVisible: boolean;
  paywallReason?: string;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  subscribe: (selectedPlan: SubscriptionPlan) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  plans: PlanDetails[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useTranslation();
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [freeAiUsesCount, setFreeAiUsesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>(undefined);

  const isPaymentConfigured = Boolean(
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ||
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  );

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_PLAN_KEY),
      AsyncStorage.getItem(STORAGE_FREE_AI_USES_KEY),
    ])
      .then(([savedPlan, savedUses]) => {
        if (
          savedPlan === 'free' ||
          savedPlan === 'monthly' ||
          savedPlan === 'annual' ||
          savedPlan === 'lifetime'
        ) {
          setPlan(savedPlan);
        }
        const parsedUses = savedUses ? parseInt(savedUses, 10) : 0;
        if (!isNaN(parsedUses) && parsedUses >= 0) {
          setFreeAiUsesCount(parsedUses);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const isPro = plan === 'monthly' || plan === 'annual' || plan === 'lifetime';

  const canCreateRoutine = useCallback(
    (currentRoutineCount: number, additionalCount = 1): boolean => {
      if (isPro) return true;
      return currentRoutineCount + additionalCount <= FREE_ROUTINE_LIMIT;
    },
    [isPro]
  );

  const remainingFreeRoutines = useCallback(
    (currentRoutineCount: number): number => {
      if (isPro) return Infinity;
      return Math.max(0, FREE_ROUTINE_LIMIT - currentRoutineCount);
    },
    [isPro]
  );

  const freeAiUsesRemaining = isPro
    ? Infinity
    : Math.max(0, FREE_AI_TRIAL_LIMIT - freeAiUsesCount);

  const canUseAiCoach = isPro || freeAiUsesCount < FREE_AI_TRIAL_LIMIT;

  const consumeFreeAiUse = useCallback(async (): Promise<void> => {
    if (isPro) return;
    setFreeAiUsesCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(STORAGE_FREE_AI_USES_KEY, String(next)).catch(() => {});
      return next;
    });
  }, [isPro]);

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallReason(undefined);
  }, []);

  const subscribe = useCallback(async (selectedPlan: SubscriptionPlan): Promise<boolean> => {
    setPlan(selectedPlan);
    await AsyncStorage.setItem(STORAGE_PLAN_KEY, selectedPlan).catch(() => {});
    return true;
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    const saved = await AsyncStorage.getItem(STORAGE_PLAN_KEY).catch(() => null);
    if (saved === 'monthly' || saved === 'annual' || saved === 'lifetime') {
      setPlan(saved);
      return true;
    }
    return false;
  }, []);

  const cancelSubscription = useCallback(async (): Promise<void> => {
    setPlan('free');
    await AsyncStorage.setItem(STORAGE_PLAN_KEY, 'free').catch(() => {});
  }, []);

  const plans = useMemo(() => getLocalizedPlans(language), [language]);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        plan,
        isLoading,
        isPaymentConfigured,
        canCreateRoutine,
        remainingFreeRoutines,
        freeAiUsesRemaining,
        canUseAiCoach,
        consumeFreeAiUse,
        paywallVisible,
        paywallReason,
        openPaywall,
        closePaywall,
        subscribe,
        restorePurchases,
        cancelSubscription,
        plans,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
  }
  return context;
}

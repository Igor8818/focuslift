/**
 * SubscriptionContext.tsx
 *
 * Gerenciamento centralizado de assinaturas e permissões PRO do FocusLift.
 * Suporta persistência local via AsyncStorage e está arquitetado para integração
 * direta com RevenueCat / In-App Purchases da Apple e Google Play.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual' | 'lifetime';

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  priceFormatted: string;
  billingPeriod: string;
  badge?: string;
  savings?: string;
  monthlyEquivalent?: string;
  popular?: boolean;
}

export const FREE_ROUTINE_LIMIT = 3;
const SUBSCRIPTION_STORAGE_KEY = '@focuslift_pro_subscription';

export const PLANS: PlanDetails[] = [
  {
    id: 'annual',
    name: 'Anual Pro',
    priceFormatted: 'R$ 89,90',
    billingPeriod: '/ano',
    badge: 'ECONOMIZE 50%',
    savings: '50% OFF',
    monthlyEquivalent: 'R$ 7,49 / mês',
    popular: true,
  },
  {
    id: 'monthly',
    name: 'Mensal Pro',
    priceFormatted: 'R$ 14,90',
    billingPeriod: '/mês',
    monthlyEquivalent: 'R$ 14,90 / mês',
  },
  {
    id: 'lifetime',
    name: 'Vitalício (Fundador)',
    priceFormatted: 'R$ 149,00',
    billingPeriod: 'pagamento único',
    badge: 'LIMITADO',
    savings: 'Pague uma única vez',
  },
];

export interface SubscriptionContextType {
  isPro: boolean;
  plan: SubscriptionPlan;
  isLoading: boolean;
  canCreateRoutine: (currentRoutineCount: number) => boolean;
  remainingFreeRoutines: (currentRoutineCount: number) => number;
  subscribe: (selectedPlan: SubscriptionPlan) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  plans: PlanDetails[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [isLoading, setIsLoading] = useState(true);

  // Carrega estado da assinatura persistido
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
        if (stored === 'monthly' || stored === 'annual' || stored === 'lifetime') {
          setPlan(stored);
        } else {
          setPlan('free');
        }
      } catch (err) {
        console.warn('Erro ao carregar status de assinatura:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const isPro = plan !== 'free';

  const canCreateRoutine = useCallback(
    (currentRoutineCount: number): boolean => {
      if (isPro) return true;
      return currentRoutineCount < FREE_ROUTINE_LIMIT;
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

  const subscribe = useCallback(async (selectedPlan: SubscriptionPlan): Promise<boolean> => {
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      // Simulação / persistência local segura (pronta para conectar SDK do RevenueCat)
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, selectedPlan);
      setPlan(selectedPlan);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      return true;
    } catch (err) {
      console.error('Falha ao processar assinatura:', err);
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (stored === 'monthly' || stored === 'annual' || stored === 'lifetime') {
        setPlan(stored);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const cancelSubscription = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
    setPlan('free');
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        plan,
        isLoading,
        canCreateRoutine,
        remainingFreeRoutines,
        subscribe,
        restorePurchases,
        cancelSubscription,
        plans: PLANS,
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

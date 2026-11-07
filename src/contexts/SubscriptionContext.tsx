/**
 * SubscriptionContext.tsx
 *
 * Gerenciamento de preferências do FocusLift.
 * Todos os recursos são 100% desbloqueados (fichas ilimitadas, AI Coach, backup).
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual' | 'lifetime';

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  priceFormatted: string;
  billingPeriod: string;
}

export const FREE_ROUTINE_LIMIT = Infinity;

export interface SubscriptionContextType {
  isPro: boolean;
  plan: SubscriptionPlan;
  isLoading: boolean;
  isPaymentConfigured: boolean;
  canCreateRoutine: (currentRoutineCount: number, additionalCount?: number) => boolean;
  remainingFreeRoutines: (currentRoutineCount: number) => number;
  subscribe: (selectedPlan: SubscriptionPlan) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  plans: PlanDetails[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<SubscriptionPlan>('lifetime');
  const [isLoading] = useState<boolean>(false);

  const canCreateRoutine = useCallback(() => true, []);
  const remainingFreeRoutines = useCallback(() => Infinity, []);

  const subscribe = useCallback(async (selectedPlan: SubscriptionPlan): Promise<boolean> => {
    setPlan(selectedPlan);
    return true;
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    setPlan('lifetime');
    return true;
  }, []);

  const cancelSubscription = useCallback(async (): Promise<void> => {
    setPlan('free');
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro: true,
        plan,
        isLoading,
        isPaymentConfigured: false,
        canCreateRoutine,
        remainingFreeRoutines,
        subscribe,
        restorePurchases,
        cancelSubscription,
        plans: [],
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

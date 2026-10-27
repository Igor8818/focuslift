/**
 * SubscriptionContext.tsx
 *
 * Gerenciamento centralizado de assinaturas e permissões PRO do FocusLift.
 * Integra nativamente com RevenueCat (`react-native-purchases`) para Google Play Billing
 * e Apple StoreKit, mantendo fallback seguro para desenvolvimento no Expo Go.
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
  rcPackageIdentifier?: string;
}

export const FREE_ROUTINE_LIMIT = 3;
const SUBSCRIPTION_STORAGE_KEY = '@focuslift_pro_subscription';

const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

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
    rcPackageIdentifier: '$rc_annual',
  },
  {
    id: 'monthly',
    name: 'Mensal Pro',
    priceFormatted: 'R$ 14,90',
    billingPeriod: '/mês',
    monthlyEquivalent: 'R$ 14,90 / mês',
    rcPackageIdentifier: '$rc_monthly',
  },
  {
    id: 'lifetime',
    name: 'Vitalício (Fundador)',
    priceFormatted: 'R$ 149,00',
    billingPeriod: 'pagamento único',
    badge: 'LIMITADO',
    savings: 'Pague uma única vez',
    rcPackageIdentifier: '$rc_lifetime',
  },
];

export interface SubscriptionContextType {
  isPro: boolean;
  plan: SubscriptionPlan;
  isLoading: boolean;
  /** True quando a chave do RevenueCat da plataforma atual está configurada e ativa. */
  isPaymentConfigured: boolean;
  canCreateRoutine: (currentRoutineCount: number, additionalCount?: number) => boolean;
  remainingFreeRoutines: (currentRoutineCount: number) => number;
  subscribe: (selectedPlan: SubscriptionPlan) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  plans: PlanDetails[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Carrega o módulo `react-native-purchases` de forma segura (lazy).
 * No Expo Go sem Dev Client nativo, o módulo nativo pode não estar disponível;
 * nesse caso retornamos null sem quebrar o app.
 */
function getPurchasesModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

function getPlatformRevenueCatKey(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    if (Platform?.OS === 'ios') return REVENUECAT_IOS_KEY.trim();
    if (Platform?.OS === 'android') return REVENUECAT_ANDROID_KEY.trim();
  } catch {
    // Ambiente de testes (Node/Vitest)
  }
  return (REVENUECAT_ANDROID_KEY || REVENUECAT_IOS_KEY).trim();
}

function inferPlanFromCustomerInfo(customerInfo: any): SubscriptionPlan {
  const entitlement = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  if (!entitlement) return 'free';
  const prodId = String(entitlement.productIdentifier || '').toLowerCase();
  if (prodId.includes('life') || prodId.includes('vital')) return 'lifetime';
  if (prodId.includes('month') || prodId.includes('mensal')) return 'monthly';
  return 'annual';
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [availablePlans, setAvailablePlans] = useState<PlanDetails[]>(PLANS);
  const [rcPackagesByPlan, setRcPackagesByPlan] = useState<Partial<Record<SubscriptionPlan, any>>>({});
  const [isPaymentConfigured, setIsPaymentConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const apiKey = getPlatformRevenueCatKey();
        const Purchases = apiKey ? getPurchasesModule() : null;

        if (apiKey && Purchases && typeof Purchases.configure === 'function') {
          try {
            Purchases.configure({ apiKey });
            setIsPaymentConfigured(true);

            const [customerInfo, offerings] = await Promise.all([
              Purchases.getCustomerInfo().catch(() => null),
              Purchases.getOfferings().catch(() => null),
            ]);

            if (customerInfo) {
              const activePlan = inferPlanFromCustomerInfo(customerInfo);
              setPlan(activePlan);
              if (activePlan !== 'free') {
                await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, activePlan);
              } else {
                await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
              }
            } else {
              // Se o aparelho estiver sem internet ao abrir, mantém o cache local da assinatura ativa
              const cached = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
              if (cached === 'monthly' || cached === 'annual' || cached === 'lifetime') {
                setPlan(cached);
              }
            }

            const currentOffering = offerings?.current;
            if (currentOffering?.availablePackages?.length) {
              const pkgMap: Partial<Record<SubscriptionPlan, any>> = {};
              const updatedPlans = PLANS.map((p) => {
                const matchedPkg = currentOffering.availablePackages.find(
                  (pkg: any) =>
                    pkg.identifier === p.rcPackageIdentifier ||
                    pkg.identifier?.toLowerCase().includes(p.id) ||
                    pkg.product?.identifier?.toLowerCase().includes(p.id)
                );
                if (matchedPkg) {
                  pkgMap[p.id] = matchedPkg;
                  return {
                    ...p,
                    priceFormatted: matchedPkg.product?.priceString || p.priceFormatted,
                  };
                }
                return p;
              });
              setRcPackagesByPlan(pkgMap);
              setAvailablePlans(updatedPlans);
            }
            return;
          } catch (rcErr) {
            console.warn('[SubscriptionContext] RevenueCat indisponível neste ambiente (Expo Go/Simulador):', rcErr);
            setIsPaymentConfigured(false);
          }
        }

        // Fallback local para desenvolvimento / cache offline
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
    (currentRoutineCount: number, additionalCount: number = 1): boolean => {
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

  const subscribe = useCallback(
    async (selectedPlan: SubscriptionPlan): Promise<boolean> => {
      try {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}

        // 1. Fluxo Real via RevenueCat (Google Play / App Store)
        if (isPaymentConfigured) {
          const Purchases = getPurchasesModule();
          const pkg = rcPackagesByPlan[selectedPlan];
          if (Purchases && pkg) {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            const resolvedPlan = inferPlanFromCustomerInfo(customerInfo);
            const finalPlan = resolvedPlan !== 'free' ? resolvedPlan : selectedPlan;
            await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, finalPlan);
            setPlan(finalPlan);
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            return true;
          }
        }

        // 2. Modo de Desenvolvimento (Expo Go / __DEV__ sem chave configurada)
        const isDevEnv = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
        if (!isDevEnv && !isPaymentConfigured) {
          console.error('[SubscriptionContext] Tentativa de compra em produção sem RevenueCat configurado.');
          return false;
        }

        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, selectedPlan);
        setPlan(selectedPlan);

        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        return true;
      } catch (err: any) {
        if (err?.userCancelled) {
          return false;
        }
        console.error('Falha ao processar assinatura:', err);
        return false;
      }
    },
    [isPaymentConfigured, rcPackagesByPlan]
  );

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      if (isPaymentConfigured) {
        const Purchases = getPurchasesModule();
        if (Purchases && typeof Purchases.restorePurchases === 'function') {
          const customerInfo = await Purchases.restorePurchases();
          const restoredPlan = inferPlanFromCustomerInfo(customerInfo);
          if (restoredPlan !== 'free') {
            await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, restoredPlan);
            setPlan(restoredPlan);
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            return true;
          }
          return false;
        }
      }

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
  }, [isPaymentConfigured]);

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
        isPaymentConfigured,
        canCreateRoutine,
        remainingFreeRoutines,
        subscribe,
        restorePurchases,
        cancelSubscription,
        plans: availablePlans,
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

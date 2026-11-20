import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme/colors';
import { useTheme } from './contexts/ThemeContext';

import { TrainingScreen } from './screens/TrainingScreen';
import { DietScreen } from './screens/DietScreen';
import { EvolutionScreen } from './screens/EvolutionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HabitsScreen } from './screens/HabitsScreen';
import { WorkoutSessionScreen } from './screens/WorkoutSessionScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PaywallModal } from './components/PaywallModal';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { type RoutineWithExercises } from './database/db';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from './contexts/LanguageContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { BrandLogo } from './components/BrandLogo';
import { retryPendingSync } from './services/autoSyncService';

export type RootStackParamList = {
  Tabs: undefined;
  WorkoutSession: {
    routine?: RoutineWithExercises | null;
    initialTitle?: string;
    initialExercises?: Array<{
      name: string;
      muscleGroup?: string;
      restTimerSeconds?: number;
      targetSets?: number;
      targetReps?: string;
      warmupSets?: number;
      notes?: string;
    }>;
    restoredDraft?: any;
  };
  Profile: undefined;
  Auth?: undefined;
};

export type TabParamList = {
  Treino: undefined;
  Dieta: undefined;
  Evolucao: undefined;
  Historico: undefined;
  Habitos: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TrainingScreenWrapper() {
  const navigation = useNavigation<any>();
  return (
    <TrainingScreen
      onStartNewWorkout={() => navigation.navigate('WorkoutSession', { routine: null })}
      onStartRoutine={(routine) => navigation.navigate('WorkoutSession', { routine })}
    />
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceBorder,
          // Respeita a safe area — corrige sobreposição nos botões do celular
          paddingBottom: Math.max(insets.bottom, 6),
          height: 58 + Math.max(insets.bottom, 6),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Treino"
        component={TrainingScreenWrapper}
        options={{
          title: t('tabs.workout'),
          tabBarLabel: t('tabs.workout'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Dieta"
        component={DietScreen}
        options={{
          title: t('tabs.diet'),
          tabBarLabel: t('tabs.diet'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Evolucao"
        component={EvolutionScreen}
        options={{
          title: t('tabs.evolution'),
          tabBarLabel: t('tabs.evolution'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Historico"
        component={HistoryScreen}
        options={{
          title: t('tabs.history'),
          tabBarLabel: t('tabs.history'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Habitos"
        component={HabitsScreen}
        options={{
          title: t('tabs.recovery'),
          tabBarLabel: t('tabs.recovery'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={21} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function WorkoutSessionWrapper({ route, navigation }: any) {
  const { routine, initialTitle, initialExercises, restoredDraft } = route.params || {};

  const title = initialTitle || (routine ? routine.name : 'Treino Livre');
  const exercises = initialExercises
    ? initialExercises
    : routine
    ? routine.exercises.map((ex: any) => ({
        name: ex.exercise_name,
        muscleGroup: ex.muscle_group || undefined,
        restTimerSeconds: ex.rest_timer_seconds,
        targetSets: ex.target_sets || 3,
        targetReps: ex.target_reps || undefined,
        warmupSets: ex.warmup_sets || 0,
        notes: ex.notes || undefined,
      }))
    : [];

  return (
    <WorkoutSessionScreen
      initialTitle={title}
      initialExercises={exercises}
      restoredDraft={restoredDraft}
      onFinish={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}

function ModalAuthWrapper({ navigation }: any) {
  const { user } = useAuth();
  useEffect(() => {
    if (user && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [user, navigation]);
  return <AuthScreen onContinueOffline={() => navigation.goBack()} />;
}

/** Stack Navigator principal — apenas exibido quando usuário está autenticado ou no modo offline. */
function MainNavigator() {
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen
          name="WorkoutSession"
          component={WorkoutSessionWrapper}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="Auth"
          component={ModalAuthWrapper}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
      <PaywallModal />
    </>
  );
}

/**
 * AppNavigator com navegação condicional:
 * - isLoadingAuth / isLoadingBoot → Splash enquanto resolve sessão JWT + flags de onboarding
 * - !user && !isOfflineMode && !onboardingDone → Onboarding rápido de 3 passos (sem barreira fria de login)
 * - !user && !isOfflineMode && wantsAuth → AuthScreen (com opção de continuar offline)
 * - user !== null || isOfflineMode || onboardingDone → MainNavigator com Bottom Tabs + PaywallModal
 */
export function AppNavigator() {
  const { user, isLoadingAuth } = useAuth();
  const { isPro, isLoading: isLoadingSubscription } = useSubscription();

  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [wantsAuth, setWantsAuth] = useState(false);
  const [isLoadingBoot, setIsLoadingBoot] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@focuslift_offline_mode'),
      AsyncStorage.getItem('@focuslift_onboarding_done'),
    ])
      .then(([offlineVal, onboardingVal]) => {
        if (offlineVal === 'true') setIsOfflineMode(true);
        if (onboardingVal === 'true') setOnboardingDone(true);
      })
      .finally(() => setIsLoadingBoot(false));
  }, []);

  const handleContinueOffline = useCallback(async () => {
    await Promise.all([
      AsyncStorage.setItem('@focuslift_offline_mode', 'true'),
      AsyncStorage.setItem('@focuslift_onboarding_done', 'true'),
    ]);
    setIsOfflineMode(true);
    setOnboardingDone(true);
    setWantsAuth(false);
  }, []);

  const handleCompleteOnboarding = useCallback(async () => {
    await Promise.all([
      AsyncStorage.setItem('@focuslift_offline_mode', 'true'),
      AsyncStorage.setItem('@focuslift_onboarding_done', 'true'),
    ]);
    setIsOfflineMode(true);
    setOnboardingDone(true);
  }, []);

  // Backup automático (PRO): reenvia treinos que ficaram pendentes por falta de conexão.
  useEffect(() => {
    if (!user?.uid || isLoadingSubscription) return;
    retryPendingSync({ userId: user.uid, isPro }).catch(() => {});
  }, [user?.uid, isPro, isLoadingSubscription]);

  // ── Splash de inicialização ──────────────────────────────────────────────
  if (isLoadingAuth || isLoadingBoot) {
    return (
      <View style={splashStyles.container}>
        <BrandLogo variant="hero" />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  // ── Usuário autenticado OU modo offline/onboarding concluído → App Principal
  if (user !== null || isOfflineMode || onboardingDone) {
    return (
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    );
  }

  // ── Tela de Login quando solicitada no Onboarding ────────────────────────
  if (wantsAuth) {
    return (
      <AuthScreen onContinueOffline={handleContinueOffline} />
    );
  }

  // ── Primeira abertura: Onboarding de 3 passos sem fricção ────────────────
  return (
    <OnboardingScreen
      onComplete={handleCompleteOnboarding}
      onOpenAuth={() => setWantsAuth(true)}
    />
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

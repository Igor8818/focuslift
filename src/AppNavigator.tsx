import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme/colors';
import { useTheme } from './contexts/ThemeContext';

import { TrainingScreen } from './screens/TrainingScreen';
import { EvolutionScreen } from './screens/EvolutionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HabitsScreen } from './screens/HabitsScreen';
import { WorkoutSessionScreen } from './screens/WorkoutSessionScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ProfileScreen } from './screens/ProfileScreen';

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
    initialExercises?: Array<{ name: string; muscleGroup?: string; restTimerSeconds?: number; targetSets?: number }>;
  };
  Profile: undefined;
  Auth?: undefined;
};

export type TabParamList = {
  Treino: undefined;
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
  const { routine, initialTitle, initialExercises } = route.params || {};

  const title = initialTitle || (routine ? routine.name : 'Treino Livre');
  const exercises = initialExercises
    ? initialExercises
    : routine
    ? routine.exercises.map((ex: any) => ({
        name: ex.exercise_name,
        muscleGroup: ex.muscle_group || undefined,
        restTimerSeconds: ex.rest_timer_seconds,
        targetSets: ex.target_sets || 3,
      }))
    : [];

  return (
    <WorkoutSessionScreen
      initialTitle={title}
      initialExercises={exercises}
      onFinish={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}

/** Stack Navigator principal — apenas exibido quando usuário está autenticado ou no modo offline. */
function MainNavigator() {
  return (
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
        component={({ navigation }: any) => (
          <AuthScreen onContinueOffline={() => navigation.goBack()} />
        )}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

/**
 * AppNavigator com navegação condicional baseada no estado de autenticação.
 *
 * Estados:
 * - isLoadingAuth → Splash de carregamento enquanto o Firebase resolve a sessão persistida
 * - user === null → AuthScreen (login, cadastro ou modo offline)
 * - user !== null → MainNavigator com as Bottom Tabs
 */
export function AppNavigator() {
  const { user, isLoadingAuth } = useAuth();
  const { isPro, isLoading: isLoadingSubscription } = useSubscription();

  // Estado local: o usuário escolheu "Continuar sem conta" nesta sessão
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Backup automático (PRO): reenvia treinos que ficaram pendentes por falta de conexão.
  useEffect(() => {
    if (!user?.uid || isLoadingSubscription) return;
    retryPendingSync({ userId: user.uid, isPro }).catch(() => {});
  }, [user?.uid, isPro, isLoadingSubscription]);

  // ── Splash de inicialização ──────────────────────────────────────────────
  if (isLoadingAuth) {
    return (
      <View style={splashStyles.container}>
        <BrandLogo variant="hero" />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  // ── Usuário autenticado OU modo offline escolhido → App Principal ─────────
  if (user !== null || isOfflineMode) {
    return (
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    );
  }

  // ── Não autenticado → Tela de Auth ───────────────────────────────────────
  return (
    <AuthScreen onContinueOffline={() => setIsOfflineMode(true)} />
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 3,
  },
  brandHighlight: {
    color: Colors.primary,
  },
});

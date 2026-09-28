import React, { useState } from 'react';
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
import { Colors } from './theme/colors';

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

export type RootStackParamList = {
  Tabs: undefined;
  WorkoutSession: {
    routine?: RoutineWithExercises | null;
    initialTitle?: string;
    initialExercises?: Array<{ name: string; muscleGroup?: string; restTimerSeconds?: number }>;
  };
  Profile: undefined;
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.surfaceBorder,
          // Respeita a safe area — corrige sobreposição nos botões do celular
          paddingBottom: Math.max(insets.bottom, 6),
          height: 56 + Math.max(insets.bottom, 6),
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Treino"
        component={TrainingScreenWrapper}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏋️</Text> }}
      />
      <Tab.Screen
        name="Evolucao"
        component={EvolutionScreen}
        options={{ title: 'Evolução', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📈</Text> }}
      />
      <Tab.Screen
        name="Historico"
        component={HistoryScreen}
        options={{ title: 'Histórico', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text> }}
      />
      <Tab.Screen
        name="Habitos"
        component={HabitsScreen}
        options={{ title: 'Recuperação', tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚡</Text> }}
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

  // Estado local: o usuário escolheu "Continuar sem conta" nesta sessão
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // ── Splash de inicialização ──────────────────────────────────────────────
  if (isLoadingAuth) {
    return (
      <View style={splashStyles.container}>
        <Text style={splashStyles.brandTitle}>
          FOCUS<Text style={splashStyles.brandHighlight}>LIFT</Text>
        </Text>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 24 }} />
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

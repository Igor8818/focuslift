import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Colors } from './theme/colors';

import { TrainingScreen } from './screens/TrainingScreen';
import { EvolutionScreen } from './screens/EvolutionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HabitsScreen } from './screens/HabitsScreen';
import { WorkoutSessionScreen } from './screens/WorkoutSessionScreen';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { type RoutineWithExercises } from './database/db';

export type RootStackParamList = {
  Tabs: undefined;
  WorkoutSession: {
    routine?: RoutineWithExercises | null;
  };
};

export type TabParamList = {
  Treino: undefined;
  Evolucao: undefined;
  Historico: undefined;
  Habitos: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';

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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.surfaceBorder,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tab.Screen 
        name="Treino" 
        component={TrainingScreenWrapper} 
        options={{ tabBarIcon: () => <Text style={{fontSize: 20}}>🏋️</Text> }}
      />
      <Tab.Screen 
        name="Evolucao" 
        component={EvolutionScreen} 
        options={{ title: 'Evolução', tabBarIcon: () => <Text style={{fontSize: 20}}>📈</Text> }}
      />
      <Tab.Screen 
        name="Historico" 
        component={HistoryScreen} 
        options={{ title: 'Histórico', tabBarIcon: () => <Text style={{fontSize: 20}}>📅</Text> }}
      />
      <Tab.Screen 
        name="Habitos" 
        component={HabitsScreen} 
        options={{ title: 'Hábitos', tabBarIcon: () => <Text style={{fontSize: 20}}>💧</Text> }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen 
          name="WorkoutSession" 
          component={WorkoutSessionWrapper}
          options={{ presentation: 'fullScreenModal' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function WorkoutSessionWrapper({ route, navigation }: any) {
  const { routine } = route.params;
  
  return (
    <WorkoutSessionScreen
      initialTitle={routine ? routine.name : 'Treino Livre'}
      initialExercises={
        routine
          ? routine.exercises.map((ex: any) => ({
              name: ex.exercise_name,
              muscleGroup: ex.muscle_group || undefined,
              restTimerSeconds: ex.rest_timer_seconds,
            }))
          : []
      }
      onFinish={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}

import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorkoutSessionScreen } from './src/screens/WorkoutSessionScreen';
import { type WorkoutWithDetails, type RoutineWithExercises } from './src/database/db';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'session'>('home');
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineWithExercises | null>(null);

  const handleStartRoutine = (routine: RoutineWithExercises) => {
    setSelectedRoutine(routine);
    setCurrentScreen('session');
  };

  const handleStartFreeWorkout = () => {
    setSelectedRoutine(null);
    setCurrentScreen('session');
  };

  const handleEndSession = () => {
    setSelectedRoutine(null);
    setCurrentScreen('home');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'home' ? (
        <HomeScreen
          onStartNewWorkout={handleStartFreeWorkout}
          onStartRoutine={handleStartRoutine}
          onSelectWorkout={(workout: WorkoutWithDetails) => {
            console.log('Treino selecionado:', workout.title);
          }}
        />
      ) : (
        <WorkoutSessionScreen
          initialTitle={selectedRoutine ? selectedRoutine.name : 'Treino Livre'}
          initialExercises={
            selectedRoutine
              ? selectedRoutine.exercises.map((ex) => ({
                  name: ex.exercise_name,
                  muscleGroup: ex.muscle_group || undefined,
                  restTimerSeconds: ex.rest_timer_seconds,
                }))
              : []
          }
          onFinish={handleEndSession}
          onCancel={handleEndSession}
        />
      )}
    </SafeAreaProvider>
  );
}

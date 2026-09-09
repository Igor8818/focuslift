import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorkoutSessionScreen } from './src/screens/WorkoutSessionScreen';
import { type WorkoutWithDetails } from './src/database/db';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'session'>('home');

  return (
    <>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'home' ? (
        <HomeScreen
          onStartNewWorkout={() => setCurrentScreen('session')}
          onSelectWorkout={(workout: WorkoutWithDetails) => {
            console.log('Treino selecionado:', workout.title);
          }}
        />
      ) : (
        <WorkoutSessionScreen
          onFinish={() => setCurrentScreen('home')}
          onCancel={() => setCurrentScreen('home')}
        />
      )}
    </>
  );
}

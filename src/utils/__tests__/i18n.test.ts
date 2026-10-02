import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LANGUAGES, Language } from '../../i18n/translations';
import {
  translateMuscleGroup,
  translateExerciseName,
  translateEquipment,
} from '../../i18n/exerciseTranslations';

describe('i18n Multi-language System', () => {
  it('should have all 5 supported languages defined', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(5);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['pt', 'en', 'es', 'de', 'fr']);
  });

  it('should verify all languages implement the required core sections', () => {
    const requiredSections = [
      'tabs',
      'common',
      'training',
      'workoutSession',
      'history',
      'habits',
      'evolution',
      'profile',
      'muscles',
    ];

    for (const lang of ['pt', 'en', 'es', 'de', 'fr'] as Language[]) {
      const dict = translations[lang];
      expect(dict).toBeDefined();

      for (const section of requiredSections) {
        expect((dict as any)[section]).toBeDefined();
      }

      // Tabs check
      expect(dict.tabs.workout).toBeTruthy();
      expect(dict.tabs.evolution).toBeTruthy();
      expect(dict.tabs.history).toBeTruthy();
      expect(dict.tabs.recovery).toBeTruthy();

      // Common check
      expect(dict.common.save).toBeTruthy();
      expect(dict.common.cancel).toBeTruthy();

      // Profile check
      expect(dict.profile.metric).toBeTruthy();
      expect(dict.profile.imperial).toBeTruthy();
    }
  });

  it('should translate single and compound muscle groups accurately across languages', () => {
    // English
    expect(translateMuscleGroup('Peito', 'en')).toBe('Chest');
    expect(translateMuscleGroup('Costas', 'en')).toBe('Back');
    expect(translateMuscleGroup('Pernas / Quadríceps', 'en')).toBe('Legs / Quads');
    expect(translateMuscleGroup('Ombros', 'en')).toBe('Shoulders');

    // Spanish
    expect(translateMuscleGroup('Peito', 'es')).toBe('Pecho');
    expect(translateMuscleGroup('Costas', 'es')).toBe('Espalda');
    expect(translateMuscleGroup('Pernas / Quadríceps', 'es')).toBe('Piernas / Cuádriceps');

    // German
    expect(translateMuscleGroup('Peito', 'de')).toBe('Brust');
    expect(translateMuscleGroup('Costas', 'de')).toBe('Rücken');

    // French
    expect(translateMuscleGroup('Peito', 'fr')).toBe('Poitrine');
    expect(translateMuscleGroup('Costas', 'fr')).toBe('Dos');

    // Portuguese fallback
    expect(translateMuscleGroup('Peito', 'pt')).toBe('Peito');
  });

  it('should translate common gym exercises to English and European languages', () => {
    expect(translateExerciseName('Supino Reto com Barra', 'en')).toBe('Barbell Bench Press');
    expect(translateExerciseName('Levantamento Terra', 'en')).toBe('Deadlift');
    expect(translateExerciseName('Agachamento Livre', 'en')).toBe('Barbell Back Squat');

    expect(translateExerciseName('Supino Reto com Barra', 'es')).toBe('Press de Banca Plano');
    expect(translateExerciseName('Levantamento Terra', 'es')).toBe('Peso Muerto');

    expect(translateExerciseName('Supino Reto com Barra', 'de')).toBe('Bankdrücken (Langhantel)');
    expect(translateExerciseName('Levantamento Terra', 'de')).toBe('Kreuzheben');

    expect(translateExerciseName('Supino Reto com Barra', 'fr')).toBe('Développé Couché Barre');
    expect(translateExerciseName('Levantamento Terra', 'fr')).toBe('Soulevé de Terre');
  });

  it('should translate equipment types across languages', () => {
    expect(translateEquipment('Barra', 'en')).toBe('Barbell');
    expect(translateEquipment('Halteres', 'en')).toBe('Dumbbells');
    expect(translateEquipment('Polia', 'en')).toBe('Cable');
    expect(translateEquipment('Máquina', 'de')).toBe('Maschine');
  });

  it('should perform metric to imperial weight conversion correctly', () => {
    const toLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;

    expect(toLbs(100)).toBe(220.5);
    expect(toLbs(80)).toBe(176.4);
    expect(toLbs(60)).toBe(132.3);
  });
});

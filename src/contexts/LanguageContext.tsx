import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Language,
  WeightUnit,
  SUPPORTED_LANGUAGES,
  LanguageOption,
  translations,
} from '../i18n/translations';
import {
  translateMuscleGroup,
  translateExerciseName,
  translateEquipment,
} from '../i18n/exerciseTranslations';

const STORAGE_LANG_KEY = '@focuslift_language';
const STORAGE_UNIT_KEY = '@focuslift_weight_unit';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => Promise<void>;
  t: (path: string, params?: Record<string, string | number>) => string;
  convertWeight: (kg: number) => number;
  formatWeight: (kg: number, withUnit?: boolean) => string;
  tMuscle: (rawGroup: string) => string;
  tExercise: (rawName: string) => string;
  tEquipment: (rawEquipment: string) => string;
  languagesList: LanguageOption[];
}

const defaultContext: LanguageContextValue = {
  language: 'pt',
  setLanguage: async () => {},
  unit: 'kg',
  setUnit: async () => {},
  t: (key: string) => key,
  convertWeight: (kg: number) => kg,
  formatWeight: (kg: number) => `${kg} kg`,
  tMuscle: (m: string) => m,
  tExercise: (e: string) => e,
  tEquipment: (eq: string) => eq,
  languagesList: SUPPORTED_LANGUAGES,
};

const LanguageContext = createContext<LanguageContextValue>(defaultContext);

/**
 * Detecta o idioma padrão do aparelho usando Intl.
 */
function getDeviceDefaultLanguage(): Language {
  try {
    const locale = Intl?.DateTimeFormat?.().resolvedOptions()?.locale?.toLowerCase() || '';
    if (locale.startsWith('pt')) return 'pt';
    if (locale.startsWith('es')) return 'es';
    if (locale.startsWith('de')) return 'de';
    if (locale.startsWith('fr')) return 'fr';
    if (locale.startsWith('en')) return 'en';
  } catch {
    // Fallback seguro se Intl não estiver disponível
  }
  return 'en';
}

/**
 * Detecta a unidade de peso padrão com base no locale.
 */
function getDeviceDefaultUnit(lang: Language): WeightUnit {
  try {
    const locale = Intl?.DateTimeFormat?.().resolvedOptions()?.locale?.toLowerCase() || '';
    if (locale.includes('-us') || locale.includes('-lr') || locale.includes('-mm')) {
      return 'lbs';
    }
  } catch {
    // Fallback
  }
  return lang === 'en' ? 'lbs' : 'kg';
}

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('pt');
  const [unit, setUnitState] = useState<WeightUnit>('kg');
  const [ready, setReady] = useState(false);

  // Carrega preferências salvas no boot
  useEffect(() => {
    async function loadSavedPreferences() {
      try {
        const [savedLang, savedUnit] = await Promise.all([
          AsyncStorage.getItem(STORAGE_LANG_KEY),
          AsyncStorage.getItem(STORAGE_UNIT_KEY),
        ]);

        if (savedLang && ['pt', 'en', 'es', 'de', 'fr'].includes(savedLang)) {
          setLanguageState(savedLang as Language);
        } else {
          const autoLang = getDeviceDefaultLanguage();
          setLanguageState(autoLang);
        }

        if (savedUnit && (savedUnit === 'kg' || savedUnit === 'lbs')) {
          setUnitState(savedUnit as WeightUnit);
        } else {
          const autoLang = (savedLang as Language) || getDeviceDefaultLanguage();
          setUnitState(getDeviceDefaultUnit(autoLang));
        }
      } catch (err) {
        // Silencioso em caso de falha de storage
      } finally {
        setReady(true);
      }
    }

    loadSavedPreferences();
  }, []);

  const setLanguage = useCallback(async (newLang: Language) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(STORAGE_LANG_KEY, newLang);
    } catch {
      // Ignora erro de storage
    }
  }, []);

  const setUnit = useCallback(async (newUnit: WeightUnit) => {
    setUnitState(newUnit);
    try {
      await AsyncStorage.setItem(STORAGE_UNIT_KEY, newUnit);
    } catch {
      // Ignora erro de storage
    }
  }, []);

  /**
   * Resolve chaves aninhadas ("training.startWorkout", "tabs.workout", etc.)
   * com fallback transparente para inglês e português.
   */
  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');

      function getValue(obj: any): string | null {
        let current = obj;
        for (const k of keys) {
          if (!current || typeof current !== 'object') return null;
          current = current[k];
        }
        return typeof current === 'string' ? current : null;
      }

      // Tenta na língua atual
      let template = getValue(translations[language]);

      // Fallback 1: Inglês
      if (!template && language !== 'en') {
        template = getValue(translations.en);
      }

      // Fallback 2: Português
      if (!template && language !== 'pt') {
        template = getValue(translations.pt);
      }

      if (!template) {
        return path;
      }

      // Interpola parâmetros como {count}, {exercise}, etc.
      if (params) {
        return Object.entries(params).reduce((str, [paramKey, val]) => {
          return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
        }, template);
      }

      return template;
    },
    [language]
  );

  /**
   * Converte valor em kg para a unidade ativa (kg ou lbs).
   */
  const convertWeight = useCallback(
    (kg: number): number => {
      if (unit === 'lbs') {
        return Math.round(kg * 2.20462 * 10) / 10;
      }
      return kg;
    },
    [unit]
  );

  /**
   * Formata valor numérico com a unidade (ex: "80 kg" ou "176.4 lbs").
   */
  const formatWeight = useCallback(
    (kg: number, withUnit = true): string => {
      const val = convertWeight(kg);
      const formatted = Number.isInteger(val) ? String(val) : val.toFixed(1);
      return withUnit ? `${formatted} ${unit}` : formatted;
    },
    [convertWeight, unit]
  );

  const tMuscle = useCallback(
    (rawGroup: string) => translateMuscleGroup(rawGroup, language),
    [language]
  );

  const tExercise = useCallback(
    (rawName: string) => translateExerciseName(rawName, language),
    [language]
  );

  const tEquipment = useCallback(
    (rawEquipment: string) => translateEquipment(rawEquipment, language),
    [language]
  );

  const contextValue = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      unit,
      setUnit,
      t,
      convertWeight,
      formatWeight,
      tMuscle,
      tExercise,
      tEquipment,
      languagesList: SUPPORTED_LANGUAGES,
    }),
    [
      language,
      setLanguage,
      unit,
      setUnit,
      t,
      convertWeight,
      formatWeight,
      tMuscle,
      tExercise,
      tEquipment,
    ]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation(): LanguageContextValue {
  return useContext(LanguageContext);
}

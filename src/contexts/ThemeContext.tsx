import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ColorTokens, type Theme } from '../theme/colors';

const STORAGE_KEY = '@focuslift_theme';

interface ThemeContextValue {
  theme: Theme;
  colors: ColorTokens;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
  isDark: true,
});

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Provedor de tema que persiste a preferência do usuário no AsyncStorage.
 * Envolve o root do app (App.tsx) para que qualquer tela consuma useTheme().
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('dark');

  // Carrega a preferência salva ao iniciar o app
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved);
        }
      })
      .catch(() => { /* ignora erro de storage */ });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors = theme === 'dark' ? darkColors : lightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para acessar o tema e as cores dinâmicas em qualquer componente.
 *
 * @example
 * const { colors, isDark, toggleTheme } = useTheme();
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Atalho para quando só precisar das cores (caso mais comum).
 *
 * @example
 * const colors = useColors();
 * <View style={{ backgroundColor: colors.background }} />
 */
export function useColors(): ColorTokens {
  return useContext(ThemeContext).colors;
}

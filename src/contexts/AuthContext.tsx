import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  type FocusLiftUser,
} from '../services/authService';

export type User = FocusLiftUser;

interface AuthContextValue {
  /** Usuário autenticado na API FocusLift (JWT), ou null se não logado / modo offline. */
  user: User | null;
  /** True enquanto o app verifica o estado inicial da sessão salva localmente. */
  isLoadingAuth: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoadingAuth: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider que observa o estado de autenticação em tempo real.
 * Envolve o root do app (App.tsx) para que qualquer tela consuma useAuth().
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoadingAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de autenticação em qualquer componente.
 *
 * @example
 * const { user, isLoadingAuth } = useAuth();
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

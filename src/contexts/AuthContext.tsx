import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebaseConfig';

interface AuthContextValue {
  /** Usuário autenticado no Firebase, ou null se não logado / modo offline. */
  user: User | null;
  /** True enquanto o Firebase ainda está determinando o estado inicial da sessão. */
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
 * Provider que observa onAuthStateChanged do Firebase em tempo real.
 * Deve envolver o root do app (App.tsx) para que qualquer tela consuma useAuth().
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }

    try {
      // Subscreve as mudanças de estado de autenticação do Firebase
      const unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          setUser(firebaseUser);
          setIsLoadingAuth(false);
        },
        () => {
          setUser(null);
          setIsLoadingAuth(false);
        }
      );

      // Limpa o listener quando o componente é desmontado
      return unsubscribe;
    } catch {
      setUser(null);
      setIsLoadingAuth(false);
    }
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

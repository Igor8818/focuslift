import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebaseConfig';

/**
 * Mapeamento de códigos de erro do Firebase para mensagens amigáveis em português.
 */
function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';

  // Log do erro real para facilitar o diagnóstico em desenvolvimento
  if (__DEV__) {
    console.warn('[Firebase Auth Error] code:', code, '| raw:', err);
  }

  const errorMap: Record<string, string> = {
    // Cadastro
    'auth/email-already-in-use':
      'Este email já está cadastrado. Tente fazer login.',
    'auth/invalid-email':
      'Endereço de email inválido.',
    'auth/weak-password':
      'A senha deve ter pelo menos 6 caracteres.',
    'auth/missing-password':
      'Por favor, insira uma senha.',
    'auth/missing-email':
      'Por favor, insira um email.',

    // Login
    'auth/user-not-found':
      'Nenhuma conta encontrada com este email.',
    'auth/wrong-password':
      'Senha incorreta. Tente novamente.',
    'auth/invalid-credential':
      'Email ou senha inválidos. Verifique e tente novamente.',
    'auth/user-disabled':
      'Esta conta foi desativada. Entre em contato com o suporte.',

    // Configuração do projeto Firebase
    'auth/operation-not-allowed':
      'Login por email não está ativado. Ative-o no Firebase Console → Authentication → Sign-in methods.',

    // Rede e limite de requisições
    'auth/too-many-requests':
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed':
      'Sem conexão com a internet. Verifique sua rede.',

    // Sessão e token
    'auth/requires-recent-login':
      'Por segurança, faça login novamente para continuar.',
    'auth/id-token-expired':
      'Sua sessão expirou. Faça login novamente.',
  };

  if (errorMap[code]) {
    return errorMap[code];
  }

  // Fallback: exibe o código real do Firebase em vez de uma mensagem genérica
  // para nunca esconder informação útil de diagnóstico
  if (code) {
    return `Erro de autenticação (${code}). Tente novamente.`;
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Cria uma nova conta com email e senha.
 */
export async function registerWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isFirebaseConfigured) {
    return {
      user: null,
      error: 'Chaves do Firebase não configuradas (.env). Toque em "Continuar sem conta" para usar o modo 100% offline.',
    };
  }
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    return { user: credential.user, error: null };
  } catch (err: unknown) {
    return { user: null, error: mapFirebaseError(err) };
  }
}

/**
 * Autentica um usuário existente com email e senha.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isFirebaseConfigured) {
    return {
      user: null,
      error: 'Chaves do Firebase não configuradas (.env). Toque em "Continuar sem conta" para usar o modo 100% offline.',
    };
  }
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    return { user: credential.user, error: null };
  } catch (err: unknown) {
    return { user: null, error: mapFirebaseError(err) };
  }
}

/**
 * Encerra a sessão do usuário autenticado.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Retorna o usuário autenticado atual ou null se não houver sessão ativa.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

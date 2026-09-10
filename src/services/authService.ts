import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

/**
 * Mapeamento de códigos de erro do Firebase para mensagens amigáveis em português.
 */
function mapFirebaseError(code: string): string {
  const errorMap: Record<string, string> = {
    'auth/email-already-in-use': 'Este email já está cadastrado. Tente fazer login.',
    'auth/invalid-email': 'Endereço de email inválido.',
    'auth/user-not-found': 'Nenhuma conta encontrada com este email.',
    'auth/wrong-password': 'Senha incorreta. Tente novamente.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente novamente.',
    'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
    'auth/invalid-credential': 'Email ou senha inválidos.',
  };
  return errorMap[code] ?? 'Ocorreu um erro inesperado. Tente novamente.';
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
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return { user: credential.user, error: null };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    return { user: null, error: mapFirebaseError(code) };
  }
}

/**
 * Autentica um usuário existente com email e senha.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { user: credential.user, error: null };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    return { user: null, error: mapFirebaseError(code) };
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

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { BrandLogo } from '../components/BrandLogo';
import { loginWithEmail, registerWithEmail } from '../services/authService';

export interface AuthScreenProps {
  /** Callback para quando o usuário escolhe continuar sem conta (modo offline). */
  onContinueOffline: () => void;
}

type AuthMode = 'login' | 'register';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onContinueOffline }) => {
  const { colors, isDark } = useTheme();
  const { language } = useTranslation();
  const isPt = language === 'pt';
  const styles = makeStyles(colors);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = mode === 'login';

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setErrorMessage(null);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    clearForm();
  };

  const validateInputs = (): boolean => {
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setErrorMessage(isPt ? 'Por favor, insira um email válido.' : 'Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage(isPt ? 'A senha deve ter pelo menos 6 caracteres.' : 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = isLogin
      ? await loginWithEmail(email, password)
      : await registerWithEmail(email, password);

    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
    }
    // Se sucesso, o onAuthStateChanged no AuthContext detecta automaticamente
    // e o AppNavigator renderiza as Tabs sem nenhum callback extra.
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo e Título ── */}
          <View style={styles.logoBlock}>
            <BrandLogo variant="hero" />
            <Text style={styles.brandTagline}>
              {isPt ? 'Seu progresso. Seu controle.' : 'Your progress. Your control.'}
            </Text>
          </View>

          {/* ── Card do Formulário ── */}
          <View style={styles.formCard}>
            {/* Toggle Login / Cadastro */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, isLogin && styles.modeBtnActive]}
                onPress={() => { setMode('login'); clearForm(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, isLogin && styles.modeBtnTextActive]}>
                  {isPt ? 'Entrar' : 'Sign In'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, !isLogin && styles.modeBtnActive]}
                onPress={() => { setMode('register'); clearForm(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, !isLogin && styles.modeBtnTextActive]}>
                  {isPt ? 'Criar Conta' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrorMessage(null); }}
                placeholder={isPt ? 'seu@email.com' : 'you@email.com'}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{isPt ? 'SENHA' : 'PASSWORD'}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrorMessage(null); }}
                  placeholder={isPt ? 'Mínimo 6 caracteres' : 'Minimum 6 characters'}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((p) => !p)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Mensagem de Erro Inline */}
            {errorMessage ? (
              <View style={styles.errorBadge}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Botão de Ação Principal */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnLoading]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isLogin
                    ? isPt ? 'Entrar na Conta' : 'Sign In'
                    : isPt ? 'Criar Minha Conta' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Link alternativo de modo */}
            <TouchableOpacity onPress={toggleMode} activeOpacity={0.7} style={styles.toggleLink}>
              <Text style={styles.toggleLinkText}>
                {isLogin
                  ? isPt ? 'Ainda não tem conta? Cadastre-se' : "Don't have an account? Sign up"
                  : isPt ? 'Já tem conta? Faça login' : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Separador ── */}
          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{isPt ? 'OU' : 'OR'}</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* ── Continuar Sem Conta ── */}
          <TouchableOpacity
            style={styles.offlineBtn}
            onPress={onContinueOffline}
            activeOpacity={0.75}
          >
            <Ionicons name="cloud-offline-outline" size={24} color={colors.textMuted} style={styles.offlineBtnIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBtnTitle}>
                {isPt ? 'Continuar sem conta' : 'Continue offline'}
              </Text>
              <Text style={styles.offlineBtnSub}>
                {isPt
                  ? 'Todos os dados ficam salvos localmente no dispositivo'
                  : 'All workout data stays safely stored on your device'}
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            {isPt
              ? 'Seus dados nunca são vendidos. O backup em nuvem é opcional e protegido com criptografia de ponta.'
              : 'Your data is never sold. Cloud backup is optional and secured with encrypted authentication.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // ── Logo ──
  logoBlock: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandTagline: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Form Card ──
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    padding: 20,
    marginBottom: 24,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: colors.background,
    fontWeight: '900',
  },

  // ── Inputs ──
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontWeight: '500',
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },
  eyeIcon: { fontSize: 18 },

  // ── Error ──
  errorBadge: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Submit ──
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnLoading: { opacity: 0.8 },
  submitBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  toggleLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Separador ──
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },
  separatorText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 12,
  },

  // ── Offline ──
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  offlineBtnIcon: { fontSize: 28 },
  offlineBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  offlineBtnSub: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  privacyNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
}


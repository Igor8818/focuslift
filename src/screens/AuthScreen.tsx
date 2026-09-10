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
import { Colors } from '../theme/colors';
import { loginWithEmail, registerWithEmail } from '../services/authService';

export interface AuthScreenProps {
  /** Callback para quando o usuário escolhe continuar sem conta (modo offline). */
  onContinueOffline: () => void;
}

type AuthMode = 'login' | 'register';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onContinueOffline }) => {
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
      setErrorMessage('Por favor, insira um email válido.');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
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
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

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
            <View style={styles.logoIconWrap}>
              <Text style={styles.logoIcon}>🏋️</Text>
            </View>
            <Text style={styles.brandTitle}>
              FOCUS<Text style={styles.brandHighlight}>LIFT</Text>
            </Text>
            <Text style={styles.brandTagline}>Seu progresso. Seu controle.</Text>
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
                  Entrar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, !isLogin && styles.modeBtnActive]}
                onPress={() => { setMode('register'); clearForm(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, !isLogin && styles.modeBtnTextActive]}>
                  Criar Conta
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
                placeholder="seu@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SENHA</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrorMessage(null); }}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors.textMuted}
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
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mensagem de Erro Inline */}
            {errorMessage ? (
              <View style={styles.errorBadge}>
                <Text style={styles.errorText}>⚠ {errorMessage}</Text>
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
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isLogin ? 'Entrar na Conta' : 'Criar Minha Conta'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Link alternativo de modo */}
            <TouchableOpacity onPress={toggleMode} activeOpacity={0.7} style={styles.toggleLink}>
              <Text style={styles.toggleLinkText}>
                {isLogin
                  ? 'Ainda não tem conta? Cadastre-se'
                  : 'Já tem conta? Faça login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Separador ── */}
          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>OU</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* ── Continuar Sem Conta ── */}
          <TouchableOpacity
            style={styles.offlineBtn}
            onPress={onContinueOffline}
            activeOpacity={0.75}
          >
            <Text style={styles.offlineBtnIcon}>📱</Text>
            <View>
              <Text style={styles.offlineBtnTitle}>Continuar sem conta</Text>
              <Text style={styles.offlineBtnSub}>
                Todos os dados ficam salvos localmente no dispositivo
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            Seus dados nunca são vendidos. O backup em nuvem é opcional e criptografado pelo Firebase.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
  logoIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoIcon: { fontSize: 36 },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  brandHighlight: { color: Colors.primary },
  brandTagline: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Form Card ──
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    marginBottom: 24,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
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
    backgroundColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modeBtnTextActive: {
    color: Colors.background,
    fontWeight: '900',
  },

  // ── Inputs ──
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Submit ──
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnLoading: { opacity: 0.8 },
  submitBtnText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  toggleLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleLinkText: {
    color: Colors.primary,
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
    backgroundColor: Colors.surfaceBorder,
  },
  separatorText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 12,
  },

  // ── Offline ──
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  offlineBtnIcon: { fontSize: 28 },
  offlineBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  offlineBtnSub: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  privacyNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

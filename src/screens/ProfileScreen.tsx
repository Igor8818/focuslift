import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { logoutUser } from '../services/authService';
import { syncLocalDataToCloud, type SyncResult } from '../services/syncService';
import {
  upsertBodyweightLog,
  getLatestBodyweight,
} from '../database/db';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Peso Corporal ────────────────────────────────────────────────────────
  const todayIso = new Date().toISOString().split('T')[0];
  const [bwInput, setBwInput] = useState('');
  const [bwSaving, setBwSaving] = useState(false);
  const [bwSaved, setBwSaved] = useState(false);
  const [bwError, setBwError] = useState<string | null>(null);

  // Carrega o último peso registrado para pré-popular o campo
  useEffect(() => {
    getLatestBodyweight()
      .then((log) => {
        if (log) {
          setBwInput(String(log.weight_kg));
        }
      })
      .catch(() => {});
  }, []);

  const avatarLetter = user?.email
    ? user.email.charAt(0).toUpperCase()
    : '?';

  // ── Sincronização ────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (!user?.uid) {
      setSyncError('Faça login para sincronizar dados com a nuvem.');
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await syncLocalDataToCloud(user.uid);
      setSyncResult(result);
      if (result.errors.length > 0) {
        setSyncError(`Sync parcial — ${result.errors.length} erro(s).`);
      }
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Erro ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const handleSaveBodyweight = useCallback(async () => {
    const parsed = parseFloat(bwInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0 || parsed > 500) {
      setBwError('Digite um peso válido entre 1 e 500 kg.');
      return;
    }
    setBwSaving(true);
    setBwError(null);
    setBwSaved(false);
    try {
      await upsertBodyweightLog({ date: todayIso, weight_kg: parsed });
      setBwSaved(true);
      setTimeout(() => setBwSaved(false), 3000);
    } catch (err) {
      setBwError('Erro ao salvar. Tente novamente.');
    } finally {
      setBwSaving(false);
    }
  }, [bwInput, todayIso]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sair da Conta',
      'Seus dados locais serão mantidos. Deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation]);

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Minha Conta</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card de Perfil ── */}
        <View style={s.profileCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileEmail} numberOfLines={1}>
              {user?.email ?? 'Modo Offline'}
            </Text>
            <Text style={s.profileBadge}>
              {user ? '✓ Conta verificada' : '📱 Sem conta'}
            </Text>
          </View>
        </View>

        {/* ── Card de Peso Corporal ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PESO CORPORAL</Text>
          <View style={s.bwCard}>
            <View style={s.bwHeader}>
              <Text style={s.bwEmoji}>⚖️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.bwTitle}>Registrar Peso de Hoje</Text>
                <Text style={s.bwDate}>{todayIso}</Text>
              </View>
            </View>

            <View style={s.bwInputRow}>
              <TextInput
                style={s.bwInput}
                value={bwInput}
                onChangeText={(v) => { setBwInput(v); setBwError(null); setBwSaved(false); }}
                placeholder="82.5"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={s.bwUnit}>kg</Text>
              <TouchableOpacity
                style={[s.bwSaveBtn, bwSaving && s.bwSaveBtnDisabled]}
                onPress={handleSaveBodyweight}
                disabled={bwSaving}
                activeOpacity={0.85}
              >
                {bwSaving ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={s.bwSaveBtnText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>

            {bwSaved ? (
              <Text style={s.bwFeedbackSuccess}>✅ Peso salvo com sucesso!</Text>
            ) : null}
            {bwError ? (
              <Text style={s.bwFeedbackError}>⚠️ {bwError}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Toggle de Tema ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>APARÊNCIA</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <View>
                <Text style={s.settingLabel}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <Text style={s.settingDesc}>
                  {isDark ? 'Tema escuro ativo' : 'Tema claro ativo'}
                </Text>
              </View>
            </View>
            <Switch
              value={!isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        {/* ── Card de Backup na Nuvem ── */}
        {user ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>BACKUP NA NUVEM</Text>

            {/* Resultado do Sync */}
            {syncResult && !syncError ? (
              <View style={s.successBadge}>
                <Text style={s.successText}>
                  ✅ {syncResult.syncedWorkouts} treinos · {syncResult.syncedHabits} dias · {syncResult.syncedRoutines} fichas
                </Text>
              </View>
            ) : null}
            {syncError ? (
              <View style={s.errorBadge}>
                <Text style={s.errorText}>⚠ {syncError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.actionBtn, s.syncBtn, isSyncing && s.btnDisabled]}
              onPress={handleSync}
              disabled={isSyncing}
              activeOpacity={0.85}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Text style={s.syncBtnIcon}>🔄</Text>
                  <Text style={s.syncBtnText}>Sincronizar Agora</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>BACKUP NA NUVEM</Text>
            <View style={s.offlineBadge}>
              <Text style={s.offlineBadgeText}>
                📱 Modo offline — faça login para ativar o backup automático na nuvem.
              </Text>
            </View>
          </View>
        )}

        {/* ── Sobre o App ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SOBRE</Text>
          <View style={s.aboutCard}>
            <Text style={s.aboutTitle}>
              FOCUS<Text style={{ color: colors.primary }}>LIFT</Text>
            </Text>
            <Text style={s.aboutVersion}>Versão 1.0.0 · Offline-first + Firebase Sync</Text>
            <Text style={s.aboutTagline}>
              Seu progresso. Seu controle. Sempre com você.
            </Text>
          </View>
        </View>

        {/* ── Sair da Conta ── */}
        {user ? (
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={s.logoutBtnText}>Sair da Conta</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

// Estilos dinâmicos que recebem as cores do tema ativo
function makeStyles(colors: ReturnType<typeof import('../contexts/ThemeContext').useColors>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 40,
      height: 40,
      justifyContent: 'center',
    },
    backIcon: {
      fontSize: 22,
      color: colors.primary,
      fontWeight: '700',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
      gap: 20,
    },

    // Profile Card
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      gap: 14,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.background,
    },
    profileInfo: { flex: 1 },
    profileEmail: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 3,
    },
    profileBadge: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '600',
    },

    // Sections
    section: {
      gap: 10,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.7,
    },

    // Setting Row (theme toggle)
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 14,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    settingIcon: { fontSize: 24 },
    settingLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    settingDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },

    // Sync
    successBadge: {
      backgroundColor: colors.successLight,
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: 10,
      padding: 10,
    },
    successText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '600',
    },
    errorBadge: {
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      padding: 10,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
    },
    actionBtn: {
      borderRadius: 14,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    syncBtn: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 5,
    },
    btnDisabled: { opacity: 0.7 },
    syncBtnIcon: { fontSize: 16 },
    syncBtnText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: '900',
    },
    offlineBadge: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 14,
    },
    offlineBadgeText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 20,
    },

    // About
    aboutCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 18,
      alignItems: 'center',
    },
    aboutTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: 2,
      marginBottom: 4,
    },
    aboutVersion: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    aboutTagline: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },

    // Logout
    logoutBtn: {
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.dangerLight,
      marginTop: 4,
    },
    logoutBtnText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: '800',
    },

    // Bodyweight Card
    bwCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      gap: 12,
    },
    bwHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    bwEmoji: {
      fontSize: 28,
    },
    bwTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    bwDate: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    bwInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bwInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      paddingVertical: 12,
      paddingHorizontal: 16,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    bwUnit: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    bwSaveBtn: {
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
    },
    bwSaveBtnDisabled: {
      opacity: 0.7,
    },
    bwSaveBtnText: {
      color: '#0A0D14',
      fontSize: 14,
      fontWeight: '900',
    },
    bwFeedbackSuccess: {
      fontSize: 13,
      color: colors.success,
      fontWeight: '600',
      textAlign: 'center',
    },
    bwFeedbackError: {
      fontSize: 13,
      color: colors.danger,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}

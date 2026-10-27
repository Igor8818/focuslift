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
import { BrandLogo } from '../components/BrandLogo';
import { isAutoSyncEnabled, setAutoSyncEnabled } from '../services/autoSyncService';
import { useTranslation } from '../contexts/LanguageContext';
import { logoutUser } from '../services/authService';
import {
  syncLocalDataToCloud,
  restoreCloudDataToLocal,
  clearSyncHashCache,
  type SyncResult,
} from '../services/syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PaywallModal } from '../components/PaywallModal';
import {
  upsertBodyweightLog,
  getLatestBodyweight,
  wipeLocalDatabase,
} from '../database/db';
import { exportRecentWorkoutsToCSV, importWorkoutsFromCSV } from '../utils/csvHandler';
import { todayLocalIso } from '../utils/date';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language, setLanguage, unit, setUnit, languagesList } = useTranslation();
  const { isPro, plan } = useSubscription();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

  const [autoSyncOn, setAutoSyncOn] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('@focuslift_last_sync')
      .then((saved) => {
        if (saved) setLastSyncTime(saved);
      })
      .catch(() => {});
    isAutoSyncEnabled().then(setAutoSyncOn).catch(() => {});
  }, []);

  const handleToggleAutoSync = useCallback(async (value: boolean) => {
    setAutoSyncOn(value);
    try {
      await setAutoSyncEnabled(value);
    } catch {}
  }, []);

  // ── Peso Corporal ────────────────────────────────────────────────────────
  const todayIso = todayLocalIso();
  const [bwInput, setBwInput] = useState('');
  const [bwSaving, setBwSaving] = useState(false);
  const [bwSaved, setBwSaved] = useState(false);
  const [bwError, setBwError] = useState<string | null>(null);

  // Carrega o último peso registrado para pré-popular o campo
  useEffect(() => {
    getLatestBodyweight()
      .then((log) => {
        if (log) {
          if (unit === 'lbs') {
            setBwInput((log.weight_kg * 2.20462).toFixed(1));
          } else {
            setBwInput(String(log.weight_kg));
          }
        }
      })
      .catch(() => {});
  }, [unit]);

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
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      const result = await syncLocalDataToCloud(user.uid);
      setSyncResult(result);
      if (result.errors.length > 0) {
        setSyncError(t('profile.syncPartial', { count: result.errors.length }));
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}
      } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString();
        const display = `${dateStr} às ${timeStr}`;
        setLastSyncTime(display);
        await AsyncStorage.setItem('@focuslift_last_sync', display);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : t('common.error'));
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } finally {
      setIsSyncing(false);
    }
  }, [user, t]);

  const handleSaveBodyweight = useCallback(async () => {
    const parsed = parseFloat(bwInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setBwError(t('profile.weightError'));
      return;
    }

    // Se estiver em lbs, converte para kg antes de salvar no SQLite
    const kgValue = unit === 'lbs' ? parsed / 2.20462 : parsed;
    if (kgValue < 20 || kgValue > 500) {
      setBwError(t('profile.weightError'));
      return;
    }

    setBwSaving(true);
    setBwError(null);
    setBwSaved(false);
    try {
      await upsertBodyweightLog({ date: todayIso, weight_kg: Math.round(kgValue * 10) / 10 });
      setBwSaved(true);
      setTimeout(() => setBwSaved(false), 3000);
    } catch (err) {
      setBwError(t('common.error'));
    } finally {
      setBwSaving(false);
    }
  }, [bwInput, todayIso, unit, t]);

  // ── Restauração da Nuvem (Cloud -> SQLite) ───────────────────────────────
  const handleRestoreFromCloud = useCallback(() => {
    if (!user?.uid) {
      setSyncError('Faça login para restaurar seus dados da nuvem.');
      return;
    }
    Alert.alert(
      'Restaurar Backup da Nuvem ☁️',
      'Isso substituirá os dados locais deste aparelho pelo backup salvo na sua conta da nuvem. Deseja continuar?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Restaurar Agora',
          onPress: async () => {
            setIsRestoring(true);
            setSyncError(null);
            try {
              const res = await restoreCloudDataToLocal(user.uid);
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
              Alert.alert(
                'Backup Restaurado! 🎉',
                `${res.restoredWorkouts} treinos, ${res.restoredRoutines} fichas e ${res.restoredHabits} dias de hábitos foram recuperados da nuvem.`
              );
            } catch (err: unknown) {
              setSyncError(err instanceof Error ? err.message : t('common.error'));
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  }, [user, t]);

  // ── Exportar e Importar CSV ──────────────────────────────────────────────
  const handleExportCsv = useCallback(async () => {
    if (!isPro) {
      setIsPaywallVisible(true);
      return;
    }
    setIsExportingCsv(true);
    try {
      const csvContent = await exportRecentWorkoutsToCSV(9999);
      const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}focuslift_treinos_${todayLocalIso()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Histórico de Treinos (CSV)',
        });
      } else {
        Alert.alert('CSV Gerado', `Arquivo salvo em: ${fileUri}`);
      }
    } catch (err: unknown) {
      Alert.alert('Erro ao Exportar', err instanceof Error ? err.message : 'Falha ao exportar planilha CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  }, [isPro]);

  const handleImportCsv = useCallback(async () => {
    setIsImportingCsv(true);
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (pickResult.canceled || !pickResult.assets || pickResult.assets.length === 0) {
        return;
      }
      const asset = pickResult.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const imported = await importWorkoutsFromCSV(content);
      if (imported.length === 0) {
        Alert.alert('Nenhum Treino Encontrado', 'Verifique se o arquivo CSV segue o formato padrão do FocusLift.');
      } else {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        Alert.alert('Importação Concluída! 🎉', `${imported.length} treinos foram importados para o seu histórico.`);
      }
    } catch (err: unknown) {
      Alert.alert('Erro ao Importar', err instanceof Error ? err.message : 'Falha ao ler arquivo CSV.');
    } finally {
      setIsImportingCsv(false);
    }
  }, []);

  // ── Logout com Isolamento de Dados Multi-Conta ───────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      t('profile.logoutTitle'),
      'Deseja manter os treinos salvos neste aparelho ou limpar os dados locais ao sair (recomendado se outra pessoa for usar este celular)?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Sair e Manter no Aparelho',
          onPress: async () => {
            await logoutUser();
            navigation.goBack();
          },
        },
        {
          text: 'Sair e Limpar Dados Locais',
          style: 'destructive',
          onPress: async () => {
            const currentUid = user?.uid;
            await wipeLocalDatabase();
            await clearSyncHashCache(currentUid);
            await AsyncStorage.removeItem('@focuslift_last_sync');
            await logoutUser();
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation, t, user]);

  const s = makeStyles(colors, isDark);

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
        <Text style={s.headerTitle}>{t('profile.title')}</Text>
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
              {user?.email ?? t('profile.offlineMode')}
            </Text>
            <Text style={s.profileBadge}>
              {user ? t('profile.verifiedAccount') : t('profile.noAccount')}
            </Text>
          </View>
        </View>

        {/* ── Seletor de Idioma (Global i18n) ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>{t('profile.languageSection')}</Text>
            <Text style={s.sectionSubtitle}>{t('profile.languageDesc')}</Text>
          </View>

          <View style={s.languageGrid}>
            {languagesList.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    s.languageCard,
                    isSelected && s.languageCardActive,
                  ]}
                  onPress={() => setLanguage(lang.code)}
                  activeOpacity={0.75}
                >
                  <Text style={s.languageFlag}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.languageLabel,
                        isSelected && s.languageLabelActive,
                      ]}
                    >
                      {lang.label}
                    </Text>
                    <Text style={s.languageRegion} numberOfLines={1}>
                      {lang.region}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={s.selectedBadge}>
                      <Text style={s.selectedBadgeCheck}>✓</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Unidades de Carga (kg vs lbs) ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>{t('profile.unitsSection')}</Text>
            <Text style={s.sectionSubtitle}>{t('profile.unitsDesc')}</Text>
          </View>

          <View style={s.unitSegmentContainer}>
            <TouchableOpacity
              style={[s.unitSegmentBtn, unit === 'kg' && s.unitSegmentBtnActive]}
              onPress={() => setUnit('kg')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  s.unitSegmentText,
                  unit === 'kg' && s.unitSegmentTextActive,
                ]}
              >
                ⚖️ {t('profile.metric')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.unitSegmentBtn, unit === 'lbs' && s.unitSegmentBtnActive]}
              onPress={() => setUnit('lbs')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  s.unitSegmentText,
                  unit === 'lbs' && s.unitSegmentTextActive,
                ]}
              >
                🏋️ {t('profile.imperial')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Card de Peso Corporal ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.bodyweight')}</Text>
          <View style={s.bwCard}>
            <View style={s.bwHeader}>
              <Text style={s.bwEmoji}>⚖️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.bwTitle}>{t('profile.recordTodayWeight')}</Text>
                <Text style={s.bwDate}>{todayIso}</Text>
              </View>
            </View>

            <View style={s.bwInputRow}>
              <TextInput
                style={s.bwInput}
                value={bwInput}
                onChangeText={(v) => { setBwInput(v); setBwError(null); setBwSaved(false); }}
                placeholder={unit === 'lbs' ? '180.0' : '82.5'}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={s.bwUnit}>{unit}</Text>
              <TouchableOpacity
                style={[s.bwSaveBtn, bwSaving && s.bwSaveBtnDisabled]}
                onPress={handleSaveBodyweight}
                disabled={bwSaving}
                activeOpacity={0.85}
              >
                {bwSaving ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={s.bwSaveBtnText}>{t('profile.saveWeight')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {bwSaved ? (
              <Text style={s.bwFeedbackSuccess}>{t('profile.weightSaved')}</Text>
            ) : null}
            {bwError ? (
              <Text style={s.bwFeedbackError}>⚠️ {bwError}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Toggle de Tema ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.appearance')}</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <View>
                <Text style={s.settingLabel}>
                  {isDark ? t('profile.darkMode') : t('profile.lightMode')}
                </Text>
                <Text style={s.settingDesc}>
                  {isDark ? t('profile.darkActive') : t('profile.lightActive')}
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

        {/* ── Status da Assinatura PRO ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ASSINATURA</Text>
          <View style={[s.proCard, isPro && s.proCardActive]}>
            <View style={s.proCardHeader}>
              <View style={[s.proIconBadge, isPro && s.proIconBadgeActive]}>
                <Text style={s.proIconText}>👑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.proCardTitle}>
                  {isPro
                    ? `FocusLift PRO (${plan === 'annual' ? 'Anual' : plan === 'monthly' ? 'Mensal' : 'Vitalício'})`
                    : 'FocusLift Gratuito'}
                </Text>
                <Text style={s.proCardDesc}>
                  {isPro
                    ? 'Acesso total a todas as ferramentas premium, rotinas ilimitadas e nuvem.'
                    : 'Limite de 3 fichas ativas. Faça o upgrade para remover limites.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.proActionBtn, isPro && s.proActionBtnManage]}
              onPress={() => setIsPaywallVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={[s.proActionBtnText, isPro && s.proActionBtnTextManage]}>
                {isPro ? '👑 Ver Detalhes do PRO' : '✨ Desbloquear FocusLift PRO'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Card de Backup na Nuvem ── */}
        {user ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('profile.cloudBackup')}</Text>

            {/* Resultado do Sync */}
            {syncResult && !syncError ? (
              <View style={s.successBadge}>
                <Text style={s.successText}>
                  {t('profile.syncSuccess', {
                    workouts: syncResult.syncedWorkouts,
                    habits: syncResult.syncedHabits,
                    routines: syncResult.syncedRoutines,
                  })}
                </Text>
              </View>
            ) : null}
            {syncError ? (
              <View style={s.errorBadge}>
                <Text style={s.errorText}>{syncError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.actionBtn, s.syncBtn, (isSyncing || isRestoring) && s.btnDisabled]}
              onPress={handleSync}
              disabled={isSyncing || isRestoring}
              activeOpacity={0.85}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Text style={s.syncBtnIcon}>🔄</Text>
                  <Text style={s.syncBtnText}>{t('profile.syncNow')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.actionBtn,
                {
                  backgroundColor: colors.surface,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  marginTop: 8,
                },
                (isSyncing || isRestoring) && s.btnDisabled,
              ]}
              onPress={handleRestoreFromCloud}
              disabled={isSyncing || isRestoring}
              activeOpacity={0.85}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Text style={s.syncBtnIcon}>☁️</Text>
                  <Text style={[s.syncBtnText, { color: colors.primary }]}>
                    Restaurar Dados da Nuvem
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {lastSyncTime ? (
              <Text style={s.lastSyncText}>
                ⏱️ Última sincronização: {lastSyncTime}
              </Text>
            ) : null}

            {/* Backup automático ao finalizar o treino — recurso PRO */}
            <View style={[s.settingRow, { marginTop: 14 }]}>
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>☁️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingLabel}>Backup automático {isPro ? '' : '👑 PRO'}</Text>
                  <Text style={s.settingDesc}>
                    {isPro
                      ? 'Envia o treino para a nuvem assim que você finaliza.'
                      : 'Sem apertar nada: seu treino vai pra nuvem ao finalizar.'}
                  </Text>
                </View>
              </View>
              {isPro ? (
                <Switch
                  value={autoSyncOn}
                  onValueChange={handleToggleAutoSync}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
                  thumbColor={colors.textPrimary}
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setIsPaywallVisible(true)}
                  activeOpacity={0.8}
                  style={s.proActionBtn}
                >
                  <Text style={s.proActionBtnText}>Ativar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('profile.cloudBackup')}</Text>
            <View style={s.offlineBadge}>
              <Text style={s.offlineBadgeText}>
                📱 Você está no modo offline. Conecte uma conta para fazer backup automático e sincronizar seus treinos na nuvem.
              </Text>
              <TouchableOpacity
                style={s.connectAccountBtn}
                onPress={() => navigation.navigate('Auth' as never)}
                activeOpacity={0.85}
              >
                <Text style={s.connectAccountBtnText}>🔐 Fazer Login / Criar Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Exportação e Importação de Planilhas (CSV) ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DADOS & PLANILHAS (CSV)</Text>
          <View style={s.bwCard}>
            <Text style={s.proCardDesc}>
              Exporte todo o seu histórico de treinos para abrir no Excel / Google Sheets ou importe backups em formato CSV.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.actionBtn,
                  {
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                  },
                  isExportingCsv && s.btnDisabled,
                ]}
                onPress={handleExportCsv}
                disabled={isExportingCsv}
                activeOpacity={0.85}
              >
                {isExportingCsv ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[s.syncBtnText, { fontSize: 13 }]}>
                    📤 Exportar CSV {isPro ? '' : '👑'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.actionBtn,
                  {
                    flex: 1,
                    backgroundColor: colors.surfaceElevated,
                    borderWidth: 1.5,
                    borderColor: colors.surfaceBorder,
                    paddingVertical: 12,
                  },
                  isImportingCsv && s.btnDisabled,
                ]}
                onPress={handleImportCsv}
                disabled={isImportingCsv}
                activeOpacity={0.85}
              >
                {isImportingCsv ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[s.syncBtnText, { fontSize: 13, color: colors.textPrimary }]}>
                    📥 Importar CSV
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Sobre o App ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SOBRE</Text>
          <View style={s.aboutCard}>
            <BrandLogo variant="hero" size={64} />
            <Text style={s.aboutVersion}>{t('profile.version')}</Text>
            <Text style={s.aboutTagline}>
              {language === 'en'
                ? 'Your progress. Your control. Built for gains.'
                : language === 'es'
                ? 'Tu progreso. Tu control. Creado para ganar fuerza.'
                : language === 'de'
                ? 'Dein Fortschritt. Deine Kontrolle. Für maximale Gains.'
                : language === 'fr'
                ? 'Votre progression. Votre contrôle. Conçu pour performer.'
                : 'Seu progresso. Seu controle. Sempre com você.'}
            </Text>
          </View>
        </View>

        {/* ── Sair da Conta ── */}
        {user ? (
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={s.logoutBtnText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <PaywallModal
        visible={isPaywallVisible}
        onClose={() => setIsPaywallVisible(false)}
      />
    </SafeAreaView>
  );
};

// Estilos dinâmicos que recebem as cores do tema ativo
function makeStyles(colors: any, isDark: boolean) {
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
    sectionHeaderRow: {
      gap: 2,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },

    // Language Selector
    languageGrid: {
      gap: 8,
    },
    languageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    languageCardActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    languageFlag: {
      fontSize: 26,
    },
    languageLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    languageLabelActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    languageRegion: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    selectedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedBadgeCheck: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '900',
    },

    // Unit Segment
    unitSegmentContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 4,
      gap: 6,
    },
    unitSegmentBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitSegmentBtnActive: {
      backgroundColor: colors.primary,
    },
    unitSegmentText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    unitSegmentTextActive: {
      color: colors.onPrimary,
      fontWeight: '800',
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

    // Pro Subscription Card
    proCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
    },
    proCardActive: {
      borderColor: 'rgba(245, 158, 11, 0.4)',
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.04)' : '#FFFBEB',
    },
    proCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    proIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proIconBadgeActive: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: '#F59E0B',
    },
    proIconText: {
      fontSize: 20,
    },
    proCardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    proCardDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    proActionBtn: {
      backgroundColor: '#F59E0B',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    proActionBtnManage: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.4)',
      shadowOpacity: 0,
      elevation: 0,
    },
    proActionBtnText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    proActionBtnTextManage: {
      color: '#F59E0B',
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
      elevation: 6,
    },
    syncBtnIcon: { fontSize: 18 },
    syncBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    btnDisabled: { opacity: 0.6 },
    lastSyncText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
      fontWeight: '500',
    },
    offlineBadge: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 16,
    },
    offlineBadgeText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    connectAccountBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    connectAccountBtnText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },

    // About
    aboutCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      alignItems: 'center',
      gap: 6,
    },
    aboutTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: 2,
    },
    aboutVersion: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    aboutTagline: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
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
      color: colors.onPrimary,
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

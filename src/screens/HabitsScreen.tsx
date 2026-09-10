import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type DailyHabits,
  getOrCreateDailyHabits,
  upsertDailyHabits,
} from '../database/db';
import { Colors } from '../theme/colors';
import { HabitsCompactBar } from '../components/HabitsCompactBar';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/authService';
import { syncLocalDataToCloud, type SyncResult } from '../services/syncService';

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const HabitsScreen: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);

  // ── Estado do Backup na Nuvem ──
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const todayStr = getTodayIsoString();

  const loadData = useCallback(async () => {
    try {
      const habits = await getOrCreateDailyHabits(todayStr);
      setDailyHabits(habits);
    } catch (error) {
      console.error('Erro ao carregar hábitos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleHabit = async (
    habitKey: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done'
  ) => {
    if (!dailyHabits) return;

    const previousHabits = { ...dailyHabits };
    const currentVal = dailyHabits[habitKey];
    const newVal = currentVal ? 0 : 1;

    const updatedLocal = {
      ...dailyHabits,
      [habitKey]: newVal,
    };
    setDailyHabits(updatedLocal);

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        [habitKey]: newVal,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error(`Erro ao atualizar o hábito ${habitKey}:`, error);
      setDailyHabits(previousHabits);
    }
  };

  const handleUpdateWater = async (amountMl: number) => {
    if (!dailyHabits) return;
    const previous = { ...dailyHabits };
    const waterTarget = dailyHabits.water_target_ml || 3000;
    const isDone = amountMl >= waterTarget ? 1 : 0;

    setDailyHabits({
      ...dailyHabits,
      water_current_ml: amountMl,
      water_done: isDone,
    });

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        water_current_ml: amountMl,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error('Erro ao atualizar água:', error);
      setDailyHabits(previous);
    }
  };

  const handleUpdateProtein = async (amountG: number) => {
    if (!dailyHabits) return;
    const previous = { ...dailyHabits };
    const proteinTarget = dailyHabits.protein_target_g || 160;
    const isDone = amountG >= proteinTarget ? 1 : 0;

    setDailyHabits({
      ...dailyHabits,
      protein_current_g: amountG,
      protein_done: isDone,
    });

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        protein_current_g: amountG,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error('Erro ao atualizar proteína:', error);
      setDailyHabits(previous);
    }
  };

  // ── Handlers de Nuvem ────────────────────────────────────────────────────

  const handleSync = async () => {
    // Guard de autenticação — nunca executa sem user (Regra #3)
    if (!user?.uid) {
      setSyncError('Você precisa estar logado para sincronizar.');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const result = await syncLocalDataToCloud(user.uid);
      setSyncResult(result);
      if (result.errors.length > 0) {
        setSyncError(`Sync parcial. ${result.errors.length} erro(s) encontrados.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar.';
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Seus dados locais serão mantidos. Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            setSyncResult(null);
            setSyncError(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando Hábitos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Hábitos Diários</Text>
        </View>

        <HabitsCompactBar
          habits={dailyHabits}
          onToggleHabit={handleToggleHabit}
          onUpdateWater={handleUpdateWater}
          onUpdateProtein={handleUpdateProtein}
        />

        {/* ── Card de Backup na Nuvem ── */}
        <View style={styles.cloudCard}>
          <View style={styles.cloudCardHeader}>
            <Text style={styles.cloudCardIcon}>☁️</Text>
            <View style={styles.cloudCardTitleBlock}>
              <Text style={styles.cloudCardTitle}>Backup na Nuvem</Text>
              <Text style={styles.cloudCardSub}>
                {user
                  ? 'Sincronize seus dados com segurança'
                  : 'Crie uma conta gratuita para fazer backup'}
              </Text>
            </View>
          </View>

          {user ? (
            /* ── Usuário Logado ── */
            <>
              <View style={styles.userInfoRow}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(user.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfoText}>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                  <Text style={styles.userBadge}>Conta verificada ✓</Text>
                </View>
              </View>

              {/* Resultado do Sync */}
              {syncResult && syncError === null ? (
                <View style={styles.syncSuccessBadge}>
                  <Text style={styles.syncSuccessText}>
                    ✅ {syncResult.syncedWorkouts} treinos · {syncResult.syncedHabits} dias de hábitos · {syncResult.syncedRoutines} fichas sincronizadas
                  </Text>
                </View>
              ) : null}

              {syncError ? (
                <View style={styles.syncErrorBadge}>
                  <Text style={styles.syncErrorText}>⚠ {syncError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
                onPress={handleSync}
                disabled={isSyncing}
                activeOpacity={0.85}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <>
                    <Text style={styles.syncBtnIcon}>🔄</Text>
                    <Text style={styles.syncBtnText}>Sincronizar Agora</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.75}
              >
                <Text style={styles.logoutBtnText}>Sair da Conta</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ── Usuário Não Logado ── */
            <>
              <Text style={styles.cloudBenefitText}>
                • Backup automático dos seus treinos e fichas{'\n'}
                • Acesso em múltiplos dispositivos{'\n'}
                • Seus dados nunca são perdidos
              </Text>

              {/* Nota: a navegação para AuthScreen é gerenciada pelo AppNavigator ao fazer logout */}
              <View style={styles.loginPromptBadge}>
                <Text style={styles.loginPromptText}>
                  📱 Você está usando o modo offline. Para ativar o backup, saia e crie uma conta na tela inicial.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
  },

  // ── Cloud Card ──
  cloudCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    marginTop: 28,
  },
  cloudCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cloudCardIcon: { fontSize: 28 },
  cloudCardTitleBlock: { flex: 1 },
  cloudCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cloudCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ── User Info ──
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.background,
  },
  userInfoText: { flex: 1 },
  userEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userBadge: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Sync Results ──
  syncSuccessBadge: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  syncSuccessText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  syncErrorBadge: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  syncErrorText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Botões ──
  syncBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  syncBtnDisabled: { opacity: 0.7 },
  syncBtnIcon: { fontSize: 16 },
  syncBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Offline mode info ──
  cloudBenefitText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 14,
  },
  loginPromptBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
  },
  loginPromptText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});

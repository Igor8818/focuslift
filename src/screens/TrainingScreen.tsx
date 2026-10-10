import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FlatList,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type DailyHabits,
  type RoutineWithExercises,
  getOrCreateDailyHabits,
  seedDefaultRoutinesIfEmpty,
  getRoutines,
  deleteRoutine,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { RoutineCard } from '../components/RoutineCard';
import { RoutineEditorModal } from '../components/RoutineEditorModal';
import { ImportWorkoutModal } from '../components/ImportWorkoutModal';
import { PresetTemplatesModal } from '../components/PresetTemplatesModal';
import { PaywallModal } from '../components/PaywallModal';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_GAP = 14;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

export interface TrainingScreenProps {
  onStartNewWorkout?: () => void;
  onStartRoutine?: (routine: RoutineWithExercises) => void;
}

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayHeaderTitle(lang = 'pt'): string {
  const d = new Date();
  const locale =
    lang === 'en'
      ? 'en-US'
      : lang === 'es'
      ? 'es-ES'
      : lang === 'de'
      ? 'de-DE'
      : lang === 'fr'
      ? 'fr-FR'
      : 'pt-BR';
  const formatted = d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({
  onStartNewWorkout,
  onStartRoutine,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language } = useTranslation();
  const { isPro, canCreateRoutine } = useSubscription();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const [isRoutineModalVisible, setIsRoutineModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithExercises | null>(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isTemplatesModalVisible, setIsTemplatesModalVisible] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>();

  const todayStr = getTodayIsoString();

  // onViewableItemsChanged para sincronizar dots — melhor performance que onScroll
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveCardIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const loadData = useCallback(async () => {
    try {
      await seedDefaultRoutinesIfEmpty();
      const [habits, routineList] = await Promise.all([
        getOrCreateDailyHabits(todayStr),
        getRoutines(),
      ]);
      setDailyHabits(habits);
      setRoutines(routineList);
    } catch (error) {
      console.error('Erro ao carregar dados da TrainingScreen:', error);
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

  const handleOpenCreateRoutine = () => {
    if (!canCreateRoutine(routines.length)) {
      setPaywallReason('Você atingiu o limite gratuito de 3 fichas. Desbloqueie o FocusLift PRO para criar fichas ilimitadas!');
      setIsPaywallVisible(true);
      return;
    }
    setEditingRoutine(null);
    setIsRoutineModalVisible(true);
  };

  const handleOpenEditRoutine = (routine: RoutineWithExercises) => {
    setEditingRoutine(routine);
    setIsRoutineModalVisible(true);
  };

  const handleDeleteRoutine = async (routine: RoutineWithExercises) => {
    try {
      await deleteRoutine(routine.id);
      setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
    } catch (error) {
      console.error('Erro ao excluir rotina:', error);
      Alert.alert('Erro', 'Não foi possível excluir a ficha.');
    }
  };

  const handleRoutineSaved = (saved: RoutineWithExercises) => {
    setRoutines((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      if (exists) {
        return prev.map((r) => (r.id === saved.id ? saved : r));
      }
      return [...prev, saved];
    });
  };

  const handleRoutinesImported = (createdList: RoutineWithExercises[]) => {
    setRoutines((prev) => [...prev, ...createdList]);
  };

  // Itens do carrossel: fichas + card de "Nova Ficha"
  const carouselItems = [...routines, { id: -1, name: '__new__' } as any];
  const totalDots = routines.length + 1; // inclui o card de nova ficha

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header com brand + streak integrado ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              FOCUS<Text style={styles.brandHighlight}>LIFT</Text>
            </Text>
            <Text style={styles.headerDate}>{getTodayHeaderTitle(language)}</Text>
          </View>

          <View style={styles.headerRight}>
            {/* Streak badge compacto integrado à header */}
            {(dailyHabits?.streak_count ?? 0) > 0 && (
              <View style={styles.streakBadgeInline}>
                <Text style={styles.streakFireInline}>🔥</Text>
                <Text style={styles.streakCountInline}>
                  {dailyHabits!.streak_count}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.themeToggleBtn}
              onPress={toggleTheme}
              activeOpacity={0.7}
              accessibilityLabel="Alternar Tema"
            >
              <Text style={styles.themeToggleIcon}>{isDark ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
              accessibilityLabel="Perfil"
            >
              <Text style={styles.profileBtnText}>
                {user?.email ? user.email.charAt(0).toUpperCase() : '?'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.proBadgeBtn, isPro && styles.proBadgeBtnActive]}
              onPress={() => {
                setPaywallReason(isPro ? 'Você já é membro FocusLift PRO! 👑' : undefined);
                setIsPaywallVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.proBadgeBtnText, isPro && styles.proBadgeBtnTextActive]}>
                👑 {isPro ? 'PRO' : 'PRO'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.freeWorkoutBtn}
              onPress={() => onStartNewWorkout?.()}
              activeOpacity={0.7}
              accessibilityLabel={t('training.quickWorkout')}
            >
              <Text style={styles.freeWorkoutIcon}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Seção de Fichas ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.sectionTitle}>{t('training.myRoutines')}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{routines.length}</Text>
              </View>
            </View>

            <View style={styles.headerButtonsRow}>
              <TouchableOpacity
                style={styles.templatesHeaderBtn}
                onPress={() => setIsTemplatesModalVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.templatesHeaderBtnText}>💡 Modelos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.importRoutineHeaderBtn}
                onPress={() => setIsImportModalVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.importRoutineHeaderBtnText}>📋 {t('training.importWorkout')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createRoutineHeaderBtn}
                onPress={handleOpenCreateRoutine}
                activeOpacity={0.75}
              >
                <Text style={styles.createRoutineHeaderBtnText}>+ {t('training.createRoutine')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Carrossel com FlatList (suporta onViewableItemsChanged nativamente) */}
          <FlatList
            data={carouselItems}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.id)}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            snapToAlignment="start"
            contentContainerStyle={styles.carouselContent}
            style={styles.carouselScrollView}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => {
              if (item.id === -1) {
                // Card de Nova Ficha ou Desbloqueio PRO
                const reachedLimit = !canCreateRoutine(routines.length);

                return (
                  <TouchableOpacity
                    style={[styles.newRoutineCard, reachedLimit && styles.newRoutineCardPro]}
                    onPress={handleOpenCreateRoutine}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.newRoutineIconCircle, reachedLimit && styles.newRoutineIconCirclePro]}>
                      <Text style={[styles.newRoutinePlusIcon, reachedLimit && styles.newRoutinePlusIconPro]}>
                        {reachedLimit ? '👑' : '+'}
                      </Text>
                    </View>
                    <Text style={[styles.newRoutineTitle, reachedLimit && styles.newRoutineTitlePro]}>
                      {reachedLimit ? 'Desbloquear Fichas Ilimitadas' : t('training.createRoutine')}
                    </Text>
                    <Text style={styles.newRoutineSubtitle}>
                      {reachedLimit
                        ? 'Você atingiu o limite de 3 fichas gratuitas. Desbloqueie o FocusLift PRO para criar sem limites!'
                        : t('training.emptyRoutinesSub')}
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <RoutineCard
                  routine={item}
                  onStartRoutine={(r) => {
                    if (onStartRoutine) {
                      onStartRoutine(r);
                    } else if (onStartNewWorkout) {
                      onStartNewWorkout();
                    }
                  }}
                  onEdit={handleOpenEditRoutine}
                  onDelete={handleDeleteRoutine}
                />
              );
            }}
          />

          {/* Pagination Dots */}
          {totalDots > 1 && (
            <View style={styles.paginationDots}>
              {Array.from({ length: totalDots }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeCardIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Streak motivacional compacto (só se tiver streak > 0) ── */}
        {(dailyHabits?.streak_count ?? 0) > 0 && (
          <View style={styles.streakBanner}>
            <Text style={styles.streakBannerFire}>🔥</Text>
            <View>
              <Text style={styles.streakBannerCount}>
                {t('habits.streakDays', { days: dailyHabits!.streak_count })}
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      <RoutineEditorModal
        visible={isRoutineModalVisible}
        routine={editingRoutine}
        onClose={() => setIsRoutineModalVisible(false)}
        onSave={handleRoutineSaved}
      />

      <ImportWorkoutModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        onRoutinesCreated={handleRoutinesImported}
      />

      <PresetTemplatesModal
        visible={isTemplatesModalVisible}
        onClose={() => setIsTemplatesModalVisible(false)}
        onImportSuccess={loadData}
      />

      <PaywallModal
        visible={isPaywallVisible}
        onClose={() => setIsPaywallVisible(false)}
        titleTrigger={paywallReason}
      />
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  brandHighlight: {
    color: colors.primary,
  },
  headerDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Streak inline na header
  streakBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.streak || '#F97316',
    gap: 3,
  },
  streakFireInline: {
    fontSize: 14,
  },
  streakCountInline: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.streak || '#F97316',
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleIcon: {
    fontSize: 16,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.background,
  },
  freeWorkoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeWorkoutIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 22,
  },
  proBadgeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeBtnActive: {
    backgroundColor: '#F59E0B',
  },
  proBadgeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  proBadgeBtnTextActive: {
    color: '#0A0D14',
  },
  // ── Seção de Fichas ──
  sectionBlock: {
    marginTop: 24,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templatesHeaderBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  templatesHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  importRoutineHeaderBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  importRoutineHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  createRoutineHeaderBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  createRoutineHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  // Carrossel via FlatList
  carouselScrollView: {
    marginHorizontal: -20,
  },
  carouselContent: {
    paddingHorizontal: 20,
    gap: CARD_GAP,
  },
  // Pagination Dots
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceBorder,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  // Card de Nova Ficha
  newRoutineCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
    width: CARD_WIDTH,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRoutineIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  newRoutinePlusIcon: {
    fontSize: 26,
    color: colors.primary,
    fontWeight: '900',
    lineHeight: 28,
  },
  newRoutineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  newRoutineSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  newRoutineCardPro: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  newRoutineIconCirclePro: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  newRoutinePlusIconPro: {
    fontSize: 22,
    color: '#F59E0B',
  },
  newRoutineTitlePro: {
    color: '#F59E0B',
  },
  // ── Streak Banner Motivacional ──
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.streak || '#F97316',
    gap: 12,
    marginBottom: 24,
  },
  streakBannerFire: {
    fontSize: 24,
  },
  streakBannerCount: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  streakBannerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
}

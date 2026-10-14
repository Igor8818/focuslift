/**
 * PresetTemplatesModal.tsx
 *
 * Modal para explorar e importar rotinas e periodizações consagradas
 * (Push/Pull/Legs, Upper/Lower, Full Body 3x, Braços & Ombros).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import {
  PRESET_ROUTINE_GROUPS,
  importPresetRoutineGroup,
  type PresetTemplateGroup,
} from '../database/db';

export interface PresetTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export const PresetTemplatesModal: React.FC<PresetTemplatesModalProps> = ({
  visible,
  onClose,
  onImportSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { t, tExercise } = useTranslation();
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleImport = async (group: PresetTemplateGroup) => {
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      setImportingId(group.id);
      const count = await importPresetRoutineGroup(group.id);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      Alert.alert(
        'Fichas Adicionadas! 🎯',
        `${count} novas rotinas de "${group.name}" foram adicionadas à sua lista de fichas com sucesso.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onImportSuccess?.();
              onClose();
            },
          },
        ]
      );
    } catch (err) {
      console.error('Erro ao importar preset:', err);
      Alert.alert('Erro', 'Não foi possível importar as rotinas. Tente novamente.');
    } finally {
      setImportingId(null);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>💡 Modelos de Treino</Text>
              <Text style={styles.subtitle}>
                Periodizações consagradas prontas para importar com 1 clique
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Templates */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {PRESET_ROUTINE_GROUPS.map((group) => {
              const isImportingThis = importingId === group.id;

              return (
                <View key={group.id} style={[styles.groupCard, { borderColor: `${group.color}40` }]}>
                  {/* Topo do card com Badge */}
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: `${group.color}20` }]}>
                      <Text style={[styles.badgeText, { color: group.color }]}>{group.badge}</Text>
                    </View>
                    <Text style={styles.routinesCountText}>
                      {group.routines.length} {group.routines.length > 1 ? 'fichas' : 'ficha'}
                    </Text>
                  </View>

                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupDesc}>{group.description}</Text>

                  {/* Resumo das Fichas incluídas */}
                  <View style={styles.routinesListWrap}>
                    {group.routines.map((r, idx) => (
                      <View key={idx} style={styles.routinePill}>
                        <View style={[styles.dot, { backgroundColor: r.color || group.color }]} />
                        <Text style={styles.routinePillName} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text style={styles.exerciseCountMini}>
                          ({r.exercises?.length ?? 0} ex)
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Botão de Importação */}
                  <TouchableOpacity
                    style={[styles.importBtn, { backgroundColor: group.color }]}
                    onPress={() => handleImport(group)}
                    disabled={isImportingThis}
                    activeOpacity={0.85}
                  >
                    {isImportingThis ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.importBtnText}>+ Adicionar Divisão à Minha Lista</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: isDark ? '#111622' : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '88%',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 30,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
      alignSelf: 'center',
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 3,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    scrollList: {
      paddingBottom: 20,
    },
    groupCard: {
      backgroundColor: isDark ? '#171E2E' : '#F8FAFC',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      marginBottom: 14,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    routinesCountText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    groupName: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    groupDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 12,
    },
    routinesListWrap: {
      gap: 6,
      marginBottom: 14,
    },
    routinePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    routinePillName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    exerciseCountMini: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    importBtn: {
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    importBtnText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
}

import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { COMMON_SUGGESTIONS } from '../utils/constants';

export interface ExerciseSuggestion {
  name: string;
  group: string;
}

export interface ExerciseSearchInputProps {
  /** Valor atual do campo de busca (nome do exercício) */
  value: string;
  /** Callback quando o usuário digita */
  onChangeText: (text: string) => void;
  /** Callback quando o usuário seleciona um exercício da lista */
  onSelectExercise: (name: string, group: string) => void;
  /** Exercícios do histórico do usuário para incluir no autocomplete */
  historicExercises?: ExerciseSuggestion[];
  /** Placeholder do campo de busca */
  placeholder?: string;
  /** Cor de destaque (herdada da ficha) */
  accentColor?: string;
}

/**
 * Campo de busca com autocomplete vertical para selecionar exercícios.
 * Combina a base pré-cadastrada (COMMON_SUGGESTIONS) com o histórico
 * do usuário, filtra em tempo real e exibe até 6 resultados.
 */
export const ExerciseSearchInput: React.FC<ExerciseSearchInputProps> = ({
  value,
  onChangeText,
  onSelectExercise,
  historicExercises = [],
  placeholder = 'Buscar exercício...',
  accentColor,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const activeAccentColor = accentColor || colors.primary;
  
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Mescla base pré-cadastrada + histórico sem duplicatas
  const allSuggestions = useMemo<ExerciseSuggestion[]>(() => {
    const seen = new Set<string>();
    const merged: ExerciseSuggestion[] = [];

    // Histórico do usuário vem primeiro (mais relevante)
    for (const ex of historicExercises) {
      const key = ex.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ name: ex.name, group: ex.group || 'Histórico' });
      }
    }

    // Base pré-cadastrada completa
    for (const ex of COMMON_SUGGESTIONS) {
      const key = ex.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(ex);
      }
    }

    return merged;
  }, [historicExercises]);

  // Filtragem em tempo real — busca por qualquer parte do nome ou grupo
  const filtered = useMemo<ExerciseSuggestion[]>(() => {
    const query = value.trim().toLowerCase();
    if (!query) return allSuggestions.slice(0, 6);

    return allSuggestions
      .filter(
        (ex) =>
          ex.name.toLowerCase().includes(query) ||
          ex.group.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [value, allSuggestions]);

  const showDropdown = isFocused && filtered.length > 0;

  const handleSelect = (item: ExerciseSuggestion) => {
    onSelectExercise(item.name, item.group);
    inputRef.current?.blur();
    setIsFocused(false);
  };

  return (
    <View style={styles.wrapper}>
      {/* Campo de busca */}
      <View
        style={[
          styles.inputContainer,
          isFocused && { borderColor: activeAccentColor },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Pequeno delay para permitir o onPress do item antes de esconder
            setTimeout(() => setIsFocused(false), 150);
          }}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              inputRef.current?.focus();
            }}
            activeOpacity={0.7}
            style={styles.clearBtn}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown de sugestões */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.name}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  index < filtered.length - 1 && styles.dropdownItemBorder,
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemLeft}>
                  <Text style={styles.dropdownItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.dropdownItemGroup}>{item.group}</Text>
                </View>
                <Text style={[styles.dropdownArrow, { color: activeAccentColor }]}>
                  ＋
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Opção de usar o texto digitado como nome personalizado */}
          {value.trim().length > 2 &&
            !filtered.some(
              (f) => f.name.toLowerCase() === value.trim().toLowerCase()
            ) && (
              <TouchableOpacity
                style={styles.customExerciseBtn}
                onPress={() => handleSelect({ name: value.trim(), group: '' })}
                activeOpacity={0.7}
              >
                <Text style={[styles.customExerciseBtnText, { color: activeAccentColor }]}>
                  ＋ Usar "{value.trim()}" como exercício personalizado
                </Text>
              </TouchableOpacity>
            )}
        </View>
      )}
    </View>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
    marginBottom: 0,
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
  },
  clearIcon: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },

  // Dropdown
  dropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  dropdownItemLeft: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  dropdownItemGroup: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 8,
  },
  customExerciseBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  customExerciseBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
}


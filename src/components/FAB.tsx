import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { Colors } from '../theme/colors';

export interface FABProps {
  onPress: () => void;
  label?: string;
}

export const FAB: React.FC<FABProps> = ({
  onPress,
  label = 'Iniciar Novo Treino',
}) => {
  return (
    <TouchableOpacity
      style={styles.fabContainer}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.content}>
        <Text style={styles.plusIcon}>+</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    color: '#0A0D14',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
    marginRight: 8,
  },
  label: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

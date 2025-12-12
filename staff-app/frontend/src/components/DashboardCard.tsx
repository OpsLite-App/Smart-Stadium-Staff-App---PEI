import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../theme';

interface DashboardCardProps {
  title: string;
  value: string;
  icon?: React.ReactNode;
}

export default function DashboardCard({ title, value, icon }: DashboardCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.decorationLine} />
      <View style={styles.content}>
        {icon && <View style={{ marginBottom: 8 }}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    width: '48%',
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    transform: [{ scale: 1 }],
    position: 'relative',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: theme.colors.cardBackgroundPressed,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  decorationLine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    backgroundColor: theme.colors.primary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  content: {
    paddingLeft: 10,
  },
  title: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
});

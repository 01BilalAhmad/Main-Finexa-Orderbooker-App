// Finexa Orderbooker
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  bgColor?: string;
  icon?: React.ReactNode;
  flex?: number;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  color = Colors.text,
  bgColor = Colors.surface,
  icon,
  flex = 1,
}: StatCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bgColor, flex }]}>
      {icon ? <View style={styles.iconRow}>{icon}</View> : null}
      <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  iconRow: {
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 3,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

// Powered by Finexa
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { formatPKR, getCreditUtilization } from '@/utils/format';

interface CreditBarProps {
  balance: number;
  creditLimit: number;
}

export const CreditBar = memo(function CreditBar({ balance, creditLimit }: CreditBarProps) {
  const pct = getCreditUtilization(balance, creditLimit);
  const barColor =
    pct >= 100 ? Colors.danger : pct >= 80 ? Colors.secondary : Colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Credit Limit</Text>
        <Text style={styles.values}>
          {formatPKR(balance)} / {formatPKR(creditLimit)}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={[styles.pct, { color: barColor }]}>{pct.toFixed(0)}% used</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginTop: Spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  values: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  track: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: Radius.full,
  },
  pct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
    textAlign: 'right',
  },
});

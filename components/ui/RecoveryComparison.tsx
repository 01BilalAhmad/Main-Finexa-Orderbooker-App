// Finexa Orderbooker
import React, { memo, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { ApiService } from '@/services/api';
import { formatPKR, getTodayDateStr } from '@/utils/format';

interface RecoveryComparisonProps {
  userId: string;
}

interface ComparisonData {
  thisWeek: number;
  lastWeek: number;
  changePct: number;
}

export const RecoveryComparison = memo(function RecoveryComparison({
  userId,
}: RecoveryComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComparison();
  }, [userId]);

  async function loadComparison() {
    try {
      // This week: today's recovery summary
      const todayStr = getTodayDateStr();
      const todayRes = await ApiService.getRecoverySummary(todayStr);
      const myToday = todayRes.orderbookers.find((ob) => ob.orderbookerId === userId);
      const thisWeekTotal = myToday?.totalRecovery ?? 0;

      // Last week: same day last week
      const lastWeekDate = new Date();
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const lastWeekStr = `${lastWeekDate.getFullYear()}-${String(lastWeekDate.getMonth() + 1).padStart(2, '0')}-${String(lastWeekDate.getDate()).padStart(2, '0')}`;
      const lastWeekRes = await ApiService.getRecoverySummary(lastWeekStr);
      const myLastWeek = lastWeekRes.orderbookers.find((ob) => ob.orderbookerId === userId);
      const lastWeekTotal = myLastWeek?.totalRecovery ?? 0;

      const changePct =
        lastWeekTotal > 0
          ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
          : thisWeekTotal > 0
          ? 100
          : 0;

      setData({ thisWeek: thisWeekTotal, lastWeek: lastWeekTotal, changePct });
    } catch {
      // Not critical
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) return null;

  // Memoize computed values to avoid recalculating on every render
  const isPositive = useMemo(() => data.changePct >= 0, [data.changePct]);
  const maxRecovery = useMemo(() => Math.max(data.thisWeek, data.lastWeek, 1), [data.thisWeek, data.lastWeek]);
  const thisWeekWidth = useMemo(() => (data.thisWeek / maxRecovery) * 100, [data.thisWeek, maxRecovery]);
  const lastWeekWidth = useMemo(() => (data.lastWeek / maxRecovery) * 100, [data.lastWeek, maxRecovery]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="compare-arrows" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Recovery Comparison</Text>
        </View>
        <Text style={styles.subtitle}>This vs Last Week</Text>
      </View>

      {/* This Week */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>This Week</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${thisWeekWidth}%`, backgroundColor: Colors.primary },
            ]}
          />
        </View>
        <Text style={[styles.rowValue, { color: Colors.primary }]}>
          {formatPKR(data.thisWeek)}
        </Text>
      </View>

      {/* Last Week */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Last Week</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${lastWeekWidth}%`, backgroundColor: Colors.textMuted },
            ]}
          />
        </View>
        <Text style={[styles.rowValue, { color: Colors.textSecondary }]}>
          {formatPKR(data.lastWeek)}
        </Text>
      </View>

      {/* Change Indicator */}
      <View style={styles.changeRow}>
        <MaterialIcons
          name={isPositive ? 'trending-up' : 'trending-down'}
          size={16}
          color={isPositive ? Colors.primary : Colors.danger}
        />
        <Text style={[styles.changeText, { color: isPositive ? Colors.primary : Colors.danger }]}>
          {isPositive ? '+' : ''}{data.changePct.toFixed(1)}%
        </Text>
        <Text style={styles.changeLabel}>
          {isPositive ? 'increase' : 'decrease'} from last week
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rowLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 64,
    fontWeight: FontWeight.medium,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: Radius.full,
  },
  rowValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    minWidth: 72,
    textAlign: 'right',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  changeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  changeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

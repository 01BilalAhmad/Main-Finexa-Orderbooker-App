// Powered by Finexa
// Feature 13: Recurring Recovery Reminder (2 weeks)
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { StorageService, ShopLastRecovery } from '@/services/storage';
import { Shop } from '@/services/api';
import { formatDate } from '@/utils/format';

interface RecoveryReminderProps {
  shops: Shop[];
  onShopPress?: (shopId: string) => void;
}

const MIN_DAYS_OVERDUE = 14;

export function RecoveryReminder({ shops, onShopPress }: RecoveryReminderProps) {
  const [overdueShops, setOverdueShops] = useState<ShopLastRecovery[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadOverdue = useCallback(async () => {
    try {
      const needingRecovery = await StorageService.getShopsNeedingRecovery(MIN_DAYS_OVERDUE);
      setOverdueShops(needingRecovery);
    } catch {
      /* not critical */
    }
  }, []);

  useEffect(() => {
    loadOverdue();
  }, [loadOverdue]);

  if (overdueShops.length === 0) return null;

  const getShopName = (shopId: string): string => {
    const shop = shops.find((s) => s.id === shopId);
    return shop?.name || 'Unknown Shop';
  };

  const getShopArea = (shopId: string): string => {
    const shop = shops.find((s) => s.id === shopId);
    return shop?.area || '';
  };

  const getDaysSince = (dateStr: string): number => {
    const last = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setIsExpanded(!isExpanded)}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="notification-important" size={18} color={Colors.secondary} />
          <Text style={styles.headerTitle}>
            {overdueShops.length} {overdueShops.length === 1 ? 'shop' : 'shops'} need attention
          </Text>
        </View>
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={Colors.textSecondary}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.shopList}>
          {overdueShops.map((entry) => {
            const daysSince = getDaysSince(entry.lastRecoveryDate);
            const shopName = getShopName(entry.shopId);
            const shopArea = getShopArea(entry.shopId);
            return (
              <Pressable
                key={entry.shopId}
                style={styles.shopCard}
                onPress={() => onShopPress?.(entry.shopId)}
              >
                <View style={styles.shopIconWrap}>
                  <MaterialIcons name="store" size={16} color={Colors.secondary} />
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
                  <Text style={styles.shopMeta} numberOfLines={1}>
                    {shopArea ? `${shopArea} · ` : ''}Last recovery: {formatDate(entry.lastRecoveryDate)}
                  </Text>
                </View>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysCount}>{daysSince}d</Text>
                  <Text style={styles.daysLabel}>ago</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.secondaryLight,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shopList: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  shopIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shopMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  daysBadge: {
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  daysCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.danger,
  },
  daysLabel: {
    fontSize: 9,
    color: Colors.danger,
    fontWeight: FontWeight.medium,
  },
});

// Finexa Recovery App
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { Shop, CompanyBalance } from '@/services/api';
import { formatPKR } from '@/utils/format';

// Helper: get display balance for a shop based on the user's assigned company
export function getShopDisplayBalance(shop: Shop, companyId?: string): { balance: number; creditLimit: number } {
  try {
    if (companyId && shop.companyBalances && Array.isArray(shop.companyBalances) && shop.companyBalances.length > 0) {
      const companyBal = shop.companyBalances.find((cb: CompanyBalance) => cb && cb.companyId === companyId);
      if (companyBal && typeof companyBal.balance === 'number') {
        return { balance: companyBal.balance, creditLimit: companyBal.creditLimit || shop.creditLimit || 0 };
      }
    }
    return { balance: shop.balance || 0, creditLimit: shop.creditLimit || 0 };
  } catch {
    return { balance: shop.balance || 0, creditLimit: shop.creditLimit || 0 };
  }
}

interface ShopCardProps {
  shop: Shop;
  isVisited: boolean;
  hasRecovery?: boolean; // Whether recovery has been submitted for this shop today
  onCollect: () => void;
  onPress: () => void;
  onGpsVisit?: () => void;
  companyId?: string;
}

export const ShopCard = memo(function ShopCard({
  shop,
  isVisited,
  hasRecovery = false,
  onCollect,
  onPress,
  onGpsVisit,
  companyId,
}: ShopCardProps) {
  const { balance: displayBalance, creditLimit: displayCreditLimit } = getShopDisplayBalance(shop, companyId);
  const isOverLimit = displayBalance > displayCreditLimit;
  const rawUtilisation = displayCreditLimit > 0 ? (displayBalance / displayCreditLimit) * 100 : 0;
  const utilisation = Math.min(rawUtilisation, 100);
  const isApproachingLimit = !isOverLimit && rawUtilisation >= 90;
  const isZeroBalance = displayBalance === 0;
  const barColor = isOverLimit ? Colors.danger : rawUtilisation >= 90 ? Colors.secondary : utilisation > 80 ? Colors.secondary : Colors.primary;

  // Recovery submitted = blue accent, visited (GPS only) = lighter blue
  const showRecoveryAccent = hasRecovery;

  // Pulsing dot animation for 90%+ utilization
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (rawUtilisation >= 90) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.6,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [rawUtilisation >= 90]);

  const handleCall = () => {
    if (shop.phone) Linking.openURL(`tel:${shop.phone}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        showRecoveryAccent && styles.cardRecoverySubmitted,
        isVisited && !showRecoveryAccent && styles.cardVisited,
        isZeroBalance && !showRecoveryAccent && styles.cardZeroBalance,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Gradient stripe on left */}
      {showRecoveryAccent && (
        <LinearGradient
          colors={['#6366F1', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.recoveryStripe}
        />
      )}
      {isVisited && !showRecoveryAccent && (
        <LinearGradient
          colors={['#818CF8', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.visitedStripe}
        />
      )}

      {/* Top row: Avatar + Info + Balance */}
      <View style={styles.topRow}>
        {/* Rounded Square Avatar */}
        <View style={[
          styles.shopAvatar,
          showRecoveryAccent && styles.shopAvatarRecovery,
          isVisited && !showRecoveryAccent && styles.shopAvatarVisited,
        ]}>
          <Text style={[
            styles.shopAvatarText,
            showRecoveryAccent && styles.shopAvatarTextRecovery,
            isVisited && !showRecoveryAccent && styles.shopAvatarTextVisited,
          ]}>
            {shop.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.shopInfo}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <Text style={styles.shopMeta} numberOfLines={1}>
            {shop.ownerName}  ·  {shop.area}
          </Text>
        </View>
        <View style={styles.balanceCol}>
          <Text style={[styles.balance, { color: displayBalance > 0 ? Colors.danger : Colors.success }]}>
            {formatPKR(displayBalance)}
          </Text>
          {showRecoveryAccent ? (
            <View style={styles.recoveryBadge}>
              <MaterialIcons name="check-circle" size={11} color="#FFFFFF" />
              <Text style={styles.recoveryBadgeText}>Recovery Added</Text>
            </View>
          ) : isVisited ? (
            <View style={styles.visitedBadge}>
              <MaterialIcons name="check-circle" size={11} color={Colors.primary} />
              <Text style={styles.visitedText}>Visited</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Over limit banner */}
      {isOverLimit ? (
        <View style={styles.overLimitBanner}>
          <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
          <MaterialIcons name="warning" size={13} color={Colors.danger} />
          <Text style={styles.overLimitText}>Over Credit Limit</Text>
        </View>
      ) : isApproachingLimit ? (
        <View style={styles.approachingLimitBanner}>
          <Animated.View style={[styles.pulseDotYellow, { transform: [{ scale: pulseAnim }] }]} />
          <MaterialIcons name="warning" size={13} color={Colors.secondary} />
          <Text style={styles.approachingLimitText}>Credit utilization at 90% — approaching limit</Text>
        </View>
      ) : isZeroBalance ? (
        <View style={styles.zeroBalanceBanner}>
          <MaterialIcons name="check-circle" size={13} color={Colors.success} />
          <Text style={styles.zeroBalanceText}>Balance Clear</Text>
        </View>
      ) : null}

      {/* Credit utilisation bar with gradient fill */}
      <View style={styles.creditRow}>
        <View style={styles.creditTrack}>
          {utilisation > 0 ? (
            <LinearGradient
              colors={barColor === Colors.danger ? ['#EF4444', '#F87171'] : barColor === Colors.secondary ? ['#F59E0B', '#FBBF24'] : ['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.creditFill, { width: `${utilisation}%` }]}
            />
          ) : null}
        </View>
        <Text style={[styles.creditPct, { color: barColor }]}>
          {utilisation.toFixed(0)}%
        </Text>
      </View>
      <Text style={styles.creditLabel}>
        Credit: {formatPKR(displayBalance)} / {formatPKR(displayCreditLimit)}
      </Text>

      {/* Actions — Pill style buttons */}
      <View style={styles.actions}>
        {hasRecovery ? (
          // Already recovered today - show disabled button
          <View style={styles.recoveryDoneBtn}>
            <MaterialIcons name="check" size={16} color="#FFFFFF" />
            <Text style={styles.recoveryDoneBtnText}>Recovery Added</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.collectBtnWrap,
              isZeroBalance && styles.collectBtnDisabled,
              pressed && !isZeroBalance && styles.collectBtnPressed,
            ]}
            onPress={onCollect}
            hitSlop={4}
            disabled={isZeroBalance}
          >
            <LinearGradient
              colors={isZeroBalance ? ['#CBD5E1', '#CBD5E1'] : ['#4F46E5', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.collectBtnGradient}
            >
              <MaterialIcons name="payments" size={16} color={isZeroBalance ? Colors.textMuted : Colors.textInverse} />
              <Text style={[styles.collectBtnText, isZeroBalance && { color: Colors.textMuted }]}>
                {isZeroBalance ? 'No Balance' : 'Collect Recovery'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
        {/* GPS - circle button */}
        <Pressable
          style={({ pressed }) => [styles.gpsBtn, isVisited && styles.gpsBtnVisited, pressed && styles.gpsBtnPressed]}
          onPress={onGpsVisit}
          hitSlop={4}
        >
          <MaterialIcons
            name={isVisited ? 'check-circle' : 'my-location'}
            size={18}
            color={isVisited ? Colors.primary : '#4F46E5'}
          />
        </Pressable>
        {/* Call - circle button */}
        <Pressable
          style={({ pressed }) => [styles.callBtn, pressed && styles.callBtnPressed]}
          onPress={handleCall}
          hitSlop={4}
        >
          <MaterialIcons name="call" size={18} color="#059669" />
        </Pressable>
        {/* Detail - circle button */}
        <Pressable
          style={({ pressed }) => [styles.detailBtn, pressed && styles.detailBtnPressed]}
          onPress={onPress}
          hitSlop={4}
        >
          <MaterialIcons name="info-outline" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    position: 'relative',
  },
  // Recovery submitted - blue accent card
  cardRecoverySubmitted: {
    borderColor: '#4F46E5',
    borderWidth: 1.5,
    backgroundColor: '#EEF2FF',
  },
  cardVisited: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#F5F3FF',
  },
  cardZeroBalance: {
    opacity: 0.75,
  },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  // Gradient stripe - recovery submitted
  recoveryStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  // Visited stripe
  visitedStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingLeft: 2,
  },
  // Rounded Square Avatar
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopAvatarRecovery: {
    backgroundColor: '#4F46E5',
  },
  shopAvatarVisited: {
    backgroundColor: Colors.primary,
  },
  shopAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#4F46E5',
  },
  shopAvatarTextRecovery: {
    color: '#FFFFFF',
  },
  shopAvatarTextVisited: {
    color: Colors.textInverse,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  shopMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  balanceCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  balance: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  // Recovery submitted badge - blue filled
  recoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4F46E5',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recoveryBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  visitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  visitedText: {
    fontSize: 10,
    color: Colors.primaryDark,
    fontWeight: FontWeight.semibold,
  },
  overLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
    marginLeft: 2,
  },
  overLimitText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: FontWeight.semibold,
  },
  approachingLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
    marginLeft: 2,
  },
  approachingLimitText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  zeroBalanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
    marginLeft: 2,
  },
  zeroBalanceText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  pulseDotYellow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 3,
    marginLeft: 2,
  },
  creditTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  creditFill: {
    height: 6,
    borderRadius: Radius.full,
  },
  creditPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    minWidth: 32,
    textAlign: 'right',
  },
  creditLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
    marginLeft: 2,
  },
  // Recovery already done - blue filled button
  recoveryDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  recoveryDoneBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  // Collect Recovery - gradient pill button
  collectBtnWrap: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  collectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  collectBtnDisabled: {
    opacity: 1,
  },
  collectBtnPressed: { opacity: 0.85 },
  collectBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textInverse,
  },
  // GPS - circle button with indigo theme
  gpsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  gpsBtnVisited: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  gpsBtnPressed: { opacity: 0.7 },
  // Call - circle button with green theme
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
  },
  callBtnPressed: { opacity: 0.7 },
  // Detail - circle button with gray theme
  detailBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  detailBtnPressed: { opacity: 0.7 },
});

// Powered by Finexa
// Profile Screen — Modern redesign with gradient hero, glassmorphism cards,
// improved KPI section, and consistent indigo theme throughout.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { useLock } from '@/hooks/useLock';
// CRASH-SAFE: Lazy import route tracking hook
const useRouteTrackingSafe = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useRouteTracking } = require('@/contexts/RouteTrackingContext');
    return useRouteTracking();
  } catch {
    // Route tracking not available — return safe defaults
    return {
      isTracking: false,
      sessionId: null,
      session: null,
      startTime: null,
      lastProximity: null,
      isStarting: false,
      isStopping: false,
      error: null,
      startRoute: async () => {},
      endRoute: async () => {},
      clearError: () => {},
    };
  }
};
import { ApiService } from '@/services/api';
import { SecureStorageService } from '@/services/secureStorage';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR, getTodayDateStr } from '@/utils/format';
import { RecoveryAnalysisChart } from '@/components/ui/RecoveryAnalysisChart';
import { RecoveryComparison } from '@/components/ui/RecoveryComparison';
import { PerformanceRanking } from '@/components/ui/PerformanceRanking';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Info Row Component ──
function InfoRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={infoRowStyles.row}>
      <View style={infoRowStyles.iconWrap}>
        <MaterialIcons name={icon as any} size={18} color="#4F46E5" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={infoRowStyles.label}>{label}</Text>
        <Text style={[infoRowStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}
const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  value: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
});

// ── KPI Card Component ──
function KpiCard({
  label,
  value,
  color,
  bg,
  icon,
  subtext,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: string;
  subtext?: string;
}) {
  return (
    <View style={[kpiStyles.card, { borderLeftColor: color }]}>
      <View style={kpiStyles.top}>
        <View style={[kpiStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <MaterialIcons name={icon as any} size={20} color={color} />
        </View>
        <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      </View>
      <Text style={kpiStyles.label}>{label}</Text>
      {subtext ? <Text style={kpiStyles.sub}>{subtext}</Text> : null}
    </View>
  );
}
const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: Colors.borderLight,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  label: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: FontWeight.semibold },
  sub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

// ── Action Row Component ──
function ActionRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [actionStyles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.995}] }]}
      onPress={onPress}
    >
      <View style={[actionStyles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={actionStyles.textWrap}>
        <Text style={[actionStyles.title, danger && { color: Colors.danger }]}>{title}</Text>
        <Text style={actionStyles.subtitle}>{subtitle}</Text>
      </View>
      {showChevron ? (
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      ) : null}
    </Pressable>
  );
}
const actionStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updatePhone, companies, selectedCompanyId } = useAuth();
  const { allShops } = useShops();
  const { setNeedsPinSetup, lock } = useLock();
  const { isTracking, isStarting, isStopping, startRoute, endRoute, startTime, error: routeError } = useRouteTrackingSafe();

  const [loggingOut, setLoggingOut] = useState(false);
  const [todayRecovery, setTodayRecovery] = useState(0);
  const [thisMonthRecovery, setThisMonthRecovery] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Phone edit state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  async function loadStats() {
    if (!user) return;
    try {
      const today = await ApiService.getRecoverySummary(getTodayDateStr());
      const myToday = today.orderbookers.find((ob) => ob.orderbookerId === user.id);
      if (myToday) setTodayRecovery(myToday.totalRecovery);

      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthTxns = await ApiService.getTransactions({
        createdBy: user.id,
        type: 'recovery',
        date: firstOfMonth,
        limit: 500,
      });
      setThisMonthRecovery(monthTxns.transactions.reduce((sum, t) => sum + t.amount, 0));
    } catch { /* not critical */ }
  }

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (trimmed && !/^[\d+\-\s()]{7,15}$/.test(trimmed)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (7-15 digits)');
      return;
    }
    setIsSavingPhone(true);
    try {
      await updatePhone(trimmed);
      setIsEditingPhone(false);
      setPhoneInput('');
      Alert.alert('Phone Updated', trimmed ? `Phone number updated to ${trimmed}` : 'Phone number removed');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update phone number');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleLogout = () => {
    // If route is active, warn user first
    if (isTracking) {
      Alert.alert(
        'Active Route Detected',
        'You have an active route session. Logging out will stop route tracking. Do you want to end the route and logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Route & Logout',
            style: 'destructive',
            onPress: async () => {
              setLoggingOut(true);
              try {
                await endRoute();
              } catch {}
              try {
                await logout();
                await SecureStorageService.clearAll();
                router.replace('/login' as any);
              } finally {
                setLoggingOut(false);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            await SecureStorageService.clearAll();
            router.replace('/login' as any);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleChangePin = () => {
    Alert.alert('Change PIN', 'Do you want to change your PIN? You will need to set a new one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change PIN',
        onPress: async () => {
          await SecureStorageService.clearPin();
          setNeedsPinSetup(true);
          lock();
        },
      },
    ]);
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Hero profile card — 3-color gradient ── */}
        <LinearGradient
          colors={['#4F46E5', '#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          {/* Decorative circles */}
          <View style={styles.bubble1} />
          <View style={styles.bubble2} />
          <View style={styles.bubble3} />

          {/* Rounded Square Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarSquare}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.activeIndicator} />
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <View style={styles.roleBadge}>
            <MaterialIcons name="badge" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.roleText}>ORDER BOOKER</Text>
          </View>
          {companies.length > 1 && selectedCompanyId ? (
            <View style={styles.companyBadge}>
              <MaterialIcons name="business" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.companyBadgeText}>
                {companies.find((c) => c.companyId === selectedCompanyId)?.companyName || user.companyName || ''}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* ── Account Details Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <MaterialIcons name="person-outline" size={16} color="#4F46E5" />
            </View>
            <Text style={styles.cardTitle}>Account Details</Text>
          </View>
          <InfoRow icon="person" label="Username" value={`@${user.username}`} />
          <View style={styles.divider} />
          {/* Phone with edit */}
          <View style={infoRowStyles.row}>
            <View style={infoRowStyles.iconWrap}>
              <MaterialIcons name="call" size={18} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={infoRowStyles.label}>Phone Number</Text>
              {isEditingPhone ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <TextInput
                    ref={phoneInputRef}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    placeholder="03XXXXXXXXX"
                    keyboardType="phone-pad"
                    maxLength={15}
                    style={{
                      flex: 1,
                      height: 36,
                      borderWidth: 1,
                      borderColor: Colors.primary,
                      borderRadius: Radius.sm,
                      paddingHorizontal: 10,
                      fontSize: FontSize.base,
                      color: Colors.text,
                      backgroundColor: Colors.background,
                    }}
                    autoFocus
                    editable={!isSavingPhone}
                    onSubmitEditing={handleSavePhone}
                  />
                  <Pressable
                    onPress={handleSavePhone}
                    disabled={isSavingPhone}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: Colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSavingPhone ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => { setIsEditingPhone(false); setPhoneInput(''); }}
                    disabled={isSavingPhone}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: Colors.borderLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={infoRowStyles.value}>{user.phone || 'Not set'}</Text>
                  <Pressable
                    onPress={() => {
                      setPhoneInput(user.phone || '');
                      setIsEditingPhone(true);
                      setTimeout(() => phoneInputRef.current?.focus(), 100);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: Colors.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons name="edit" size={14} color={Colors.primary} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <InfoRow
            icon="verified-user"
            label="Account Status"
            value={user.status === 'active' ? 'Active' : user.status}
            valueColor={user.status === 'active' ? '#10B981' : undefined}
          />
          {user.companyName || selectedCompanyId ? (
            <>
              <View style={styles.divider} />
              <InfoRow
                icon="business"
                label="Company"
                value={selectedCompanyId
                  ? companies.find((c) => c.companyId === selectedCompanyId)?.companyName || user.companyName || 'N/A'
                  : user.companyName || 'N/A'
                }
              />
            </>
          ) : null}
        </View>

        {/* ── Performance KPIs ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderIcon}>
            <MaterialIcons name="analytics" size={16} color="#4F46E5" />
          </View>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
        </View>
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Month Recovery"
            value={
              thisMonthRecovery >= 1000000
                ? `Rs. ${(thisMonthRecovery / 1000000).toFixed(1)}M`
                : thisMonthRecovery >= 1000
                ? `Rs. ${(thisMonthRecovery / 1000).toFixed(0)}K`
                : formatPKR(thisMonthRecovery)
            }
            color={Colors.primary}
            bg={Colors.primaryLight}
            icon="trending-up"
          />
          <KpiCard
            label="Today's Recovery"
            value={
              todayRecovery >= 1000
                ? `Rs. ${(todayRecovery / 1000).toFixed(0)}K`
                : formatPKR(todayRecovery)
            }
            color="#3B82F6"
            bg="#EFF6FF"
            icon="today"
            subtext="Pending approval"
          />
          <KpiCard
            label="Shops Assigned"
            value={String(allShops.length)}
            color={Colors.secondary}
            bg={Colors.secondaryLight}
            icon="store"
          />
        </View>

        {/* Recovery Comparison: This vs Last Week */}
        <RecoveryComparison userId={user.id} />

        {/* ── Recovery Analysis Toggle ── */}
        <Pressable
          style={({ pressed }) => [styles.analysisToggle, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
          onPress={() => setShowAnalysis((v) => !v)}
        >
          <View style={styles.analysisToggleLeft}>
            <View style={styles.analysisToggleIcon}>
              <MaterialIcons name="analytics" size={20} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.analysisToggleTitle}>Recovery Analysis</Text>
              <Text style={styles.analysisToggleSub}>Credit vs recovery chart</Text>
            </View>
          </View>
          <View style={[styles.toggleIconWrap, showAnalysis && styles.toggleIconWrapActive]}>
            <MaterialIcons
              name={showAnalysis ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={22}
              color={showAnalysis ? '#4F46E5' : Colors.textSecondary}
            />
          </View>
        </Pressable>

        {showAnalysis ? <RecoveryAnalysisChart userId={user.id} /> : null}

        {/* Performance Ranking */}
        <PerformanceRanking />

        {/* ── Route Tracking Section ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderIcon}>
            <MaterialIcons name="navigation" size={16} color="#4F46E5" />
          </View>
          <Text style={styles.sectionTitle}>Route Tracking</Text>
        </View>

        {routeError ? (
          <View style={{
            marginHorizontal: Spacing.md,
            marginBottom: Spacing.sm,
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#FECACA',
          }}>
            <Text style={{ fontSize: FontSize.xs, color: '#DC2626' }}>{routeError}</Text>
          </View>
        ) : null}

        {isTracking ? (
          <View style={{
            marginHorizontal: Spacing.md,
            marginBottom: Spacing.sm,
            backgroundColor: '#ECFDF5',
            borderRadius: 16,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: '#A7F3D0',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: '#10B981',
                // Simple pulse effect
              }} />
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#065F46' }}>
                Route Active
              </Text>
            </View>
            <Text style={{ fontSize: FontSize.xs, color: '#047857', marginBottom: 12 }}>
              Started at {startTime ? new Date(startTime).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }) : '--:--'}
              {'\n'}Your live location is being tracked on the admin panel.
            </Text>
            <Pressable
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: pressed ? '#DC2626' : '#EF4444',
                borderRadius: 12,
                paddingVertical: 10,
              }]}
              onPress={() => {
                Alert.alert(
                  'End Route',
                  'Are you sure you want to end the route? This will stop GPS tracking.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End Route', style: 'destructive', onPress: endRoute },
                  ]
                );
              }}
              disabled={isStopping}
            >
              {isStopping ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="stop" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    End Route
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [actionStyles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
            onPress={() => {
              Alert.alert(
                'Start Route',
                'Start tracking your route? Your live location will be visible to the admin panel.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Start Route', onPress: startRoute },
                ]
              );
            }}
            disabled={isStarting}
          >
            <View style={[actionStyles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
              {isStarting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <MaterialIcons name="navigation" size={20} color="#10B981" />
              )}
            </View>
            <View style={actionStyles.textWrap}>
              <Text style={actionStyles.title}>Start Route</Text>
              <Text style={actionStyles.subtitle}>Begin GPS tracking for live route monitoring</Text>
            </View>
          </Pressable>
        )}

        {/* ── Actions Section ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderIcon}>
            <MaterialIcons name="settings" size={16} color="#4F46E5" />
          </View>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        <ActionRow
          icon="pin"
          iconColor="#4F46E5"
          iconBg="#EEF2FF"
          title="Change PIN"
          subtitle="Update your 4-digit security PIN"
          onPress={handleChangePin}
        />

        {/* Gradient Logout Button */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtnWrap, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          <LinearGradient
            colors={['#EF4444', '#F87171']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutBtnGradient}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="logout" size={20} color={Colors.textInverse} />
                <Text style={styles.logoutBtnText}>Logout</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingBottom: 100 },
  
  // ── Hero ──
  profileHero: {
    alignItems: 'center',
    paddingTop: Spacing.xl + 4,
    paddingBottom: Spacing.xl + 8,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  bubble1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(129,140,248,0.15)',
    top: -90,
    right: -70,
  },
  bubble2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(129,140,248,0.10)',
    bottom: -50,
    left: -40,
  },
  bubble3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 40,
    left: 30,
  },
  avatarWrap: { position: 'relative', marginBottom: Spacing.md },
  avatarSquare: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { fontSize: FontSize.xxl + 2, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#A7F3D0',
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  profileName: {
    fontSize: FontSize.xl + 2,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF', letterSpacing: 1 },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginTop: Spacing.sm,
  },
  companyBadgeText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: FontWeight.semibold,
  },

  // ── Glassmorphism Info Card ──
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.md,
    margin: Spacing.md,
    marginTop: -Spacing.md,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },

  // ── KPI Grid ──
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },

  // ── Analysis Toggle ──
  analysisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  analysisToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analysisToggleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  analysisToggleTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  analysisToggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconWrapActive: {
    backgroundColor: '#EEF2FF',
  },

  // ── Logout Button ──
  logoutBtnWrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadow.md,
  },
  logoutBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 15,
  },
  logoutBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textInverse },
});

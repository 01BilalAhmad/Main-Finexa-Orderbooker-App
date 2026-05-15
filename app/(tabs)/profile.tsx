// Powered by Finexa
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
import { ApiService } from '@/services/api';
import { SecureStorageService } from '@/services/secureStorage';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR, getTodayDateStr } from '@/utils/format';
import { RecoveryAnalysisChart } from '@/components/ui/RecoveryAnalysisChart';
import { RecoveryComparison } from '@/components/ui/RecoveryComparison';
import { PerformanceRanking } from '@/components/ui/PerformanceRanking';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoRowStyles.row}>
      <View style={infoRowStyles.iconWrap}>
        <MaterialIcons name={icon as any} size={18} color="#4F46E5" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={infoRowStyles.label}>{label}</Text>
        <Text style={infoRowStyles.value}>{value}</Text>
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
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
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
    <View style={[kpiStyles.card, { backgroundColor: bg }]}>
      <View style={kpiStyles.top}>
        <View style={[kpiStyles.iconWrap, { backgroundColor: color + '22' }]}>
          <MaterialIcons name={icon as any} size={20} color={color} />
        </View>
      </View>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.7)',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  top: { marginBottom: 6 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 2 },
  label: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  sub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updatePhone, companies, selectedCompanyId } = useAuth();
  const { allShops } = useShops();
  const { setNeedsPinSetup, lock } = useLock();

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
        {/* Hero profile card — 3-color gradient */}
        <LinearGradient
          colors={['#4F46E5', '#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          {/* Decorative circles */}
          <View style={styles.bubble1} />
          <View style={styles.bubble2} />

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
        </LinearGradient>

        {/* Glassmorphism Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <InfoRow icon="person" label="Username" value={`@${user.username}`} />
          <View style={styles.divider} />
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

        {/* Performance KPIs */}
        <Text style={styles.sectionTitle}>Performance Overview</Text>
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
            color={Colors.blue}
            bg={Colors.blueLight}
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

        {/* Recovery Analysis Chart */}
        <Pressable
          style={({ pressed }) => [styles.analysisToggle, pressed && { opacity: 0.8 }]}
          onPress={() => setShowAnalysis((v) => !v)}
        >
          <View style={styles.analysisToggleLeft}>
            <View style={styles.analysisToggleIcon}>
              <MaterialIcons name="analytics" size={18} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.analysisToggleTitle}>Recovery Analysis</Text>
              <Text style={styles.analysisToggleSub}>Credit vs recovery chart</Text>
            </View>
          </View>
          <MaterialIcons
            name={showAnalysis ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={22}
            color={Colors.textSecondary}
          />
        </Pressable>

        {showAnalysis ? <RecoveryAnalysisChart userId={user.id} /> : null}

        {/* Performance Ranking */}
        <PerformanceRanking />

        {/* Change PIN */}
        <Pressable
          style={({ pressed }) => [styles.changePinBtn, pressed && { opacity: 0.8 }]}
          onPress={handleChangePin}
        >
          <View style={styles.changePinLeft}>
            <View style={styles.changePinIcon}>
              <MaterialIcons name="pin" size={18} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.changePinTitle}>Change PIN</Text>
              <Text style={styles.changePinSub}>Update your 4-digit security PIN</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
        </Pressable>

        {/* Gradient Logout Button */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtnWrap, pressed && { opacity: 0.85 }]}
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
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.md },
  profileHero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  bubble1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(129,140,248,0.15)',
    top: -80,
    right: -60,
  },
  bubble2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(129,140,248,0.10)',
    bottom: -40,
    left: -30,
  },
  avatarWrap: { position: 'relative', marginBottom: Spacing.md },
  // Rounded Square Avatar
  avatarSquare: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#A7F3D0',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  profileName: {
    fontSize: FontSize.xl,
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
  // Glassmorphism Info Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 20,
    padding: Spacing.md,
    margin: Spacing.md,
    marginTop: -Spacing.md,
    ...Shadow.lg,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  divider: { height: 1, backgroundColor: Colors.borderLight },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  analysisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  analysisToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analysisToggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisToggleTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  analysisToggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  // Gradient Logout Button
  logoutBtnWrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 30,
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
  changePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  changePinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changePinIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePinTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  changePinSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
});

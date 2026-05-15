// Powered by Finexa
// Recovery Receipt — Dark Indigo professional design matching the reference.
// Deep blue/indigo background with white text, green accents, and all details preserved.
// Urdu statement is preserved at the bottom.
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { formatPKR } from '@/utils/format';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface RecoveryReceiptProps {
  visible: boolean;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  shopPhone: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
  onClose: () => void;
}

/** Format phone number to international format (923001234567) */
function formatPhoneIntl(phone: string): string {
  let p = phone.trim().replace(/[^0-9]/g, '');
  if (p.startsWith('+')) p = p.substring(1);
  if (p.startsWith('0')) p = p.substring(1);
  if (!p.startsWith('92')) p = '92' + p;
  return p.replace(/[^0-9]/g, '');
}

export function RecoveryReceipt({
  visible,
  shopName,
  shopAddress,
  shopOwnerName,
  shopPhone,
  openingBalance,
  recoveryAmount,
  remainingBalance,
  companyName,
  orderbookerName,
  distributorPhone,
  onClose,
}: RecoveryReceiptProps) {
  const receiptRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedImageUri, setSavedImageUri] = useState<string | null>(null);
  const [imageSavedToGallery, setImageSavedToGallery] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsCapturing(false);
      setSavedImageUri(null);
      setImageSavedToGallery(false);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible]);

  const today = new Date().toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeNow = new Date().toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  /**
   * Capture receipt as image and save to gallery.
   * Returns the gallery URI if successful.
   */
  const captureAndSaveToGallery = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    // Wait for UI to fully render
    await new Promise(r => setTimeout(r, 800));

    // Step 1: Capture receipt as image
    let imageUri: string;
    try {
      imageUri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
    } catch (captureErr) {
      console.error('[RecoveryReceipt] captureRef failed:', captureErr);
      throw new Error('Failed to capture receipt image');
    }

    if (!imageUri) {
      throw new Error('Image capture returned empty URI');
    }

    console.log('[RecoveryReceipt] Image captured at:', imageUri);

    // Ensure URI has file:// prefix for MediaLibrary
    const normalizedUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

    // Step 2: Save image to device Gallery
    let savedAssetUri: string | null = null;
    try {
      // Request permissions — try with full access first, fallback to writeOnly
      let permResult = await MediaLibrary.requestPermissionsAsync(false);
      console.log('[RecoveryReceipt] MediaLibrary permission status (full):', permResult.status);
      
      if (permResult.status !== 'granted') {
        permResult = await MediaLibrary.requestPermissionsAsync(true);
        console.log('[RecoveryReceipt] MediaLibrary permission status (writeOnly):', permResult.status);
      }

      if (permResult.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(normalizedUri);
        try {
          await MediaLibrary.createAlbumAsync('AlFalah Receipts', asset, false);
        } catch {
          try {
            const album = await MediaLibrary.getAlbumAsync('AlFalah Receipts');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          } catch {}
        }
        savedAssetUri = asset.uri;
        setImageSavedToGallery(true);
        console.log('[RecoveryReceipt] Image saved to gallery:', asset.uri);
      } else if (permResult.status === 'limited') {
        try {
          const asset = await MediaLibrary.createAssetAsync(normalizedUri);
          savedAssetUri = asset.uri;
          setImageSavedToGallery(true);
        } catch (limitedErr) {
          console.warn('[RecoveryReceipt] Could not save even with limited access:', limitedErr);
        }
      } else {
        console.warn('[RecoveryReceipt] MediaLibrary permission denied');
        Alert.alert(
          'Gallery Permission Needed',
          'Please allow gallery access to save receipt images. You can still send via WhatsApp.',
          [{ text: 'OK' }]
        );
      }
    } catch (galleryErr: any) {
      console.warn('[RecoveryReceipt] Could not save to gallery:', galleryErr?.message || galleryErr);
    }

    return savedAssetUri || imageUri;
  };

  /**
   * First-time send: capture image, save to gallery, open WhatsApp
   */
  const handleShareImage = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);

          if (imageSavedToGallery) {
            Alert.alert(
              'Receipt Ready!',
              `Receipt saved in Gallery (AlFalah Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select receipt → Send`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Receipt Ready',
              `WhatsApp chat opened for ${shopName}.\n\nAttach the receipt image from your Gallery to send it.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp to send receipt.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Share failed:', error);
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Re-send: recapture receipt image, save to gallery, open WhatsApp
   */
  const handleResend = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          Alert.alert(
            'Receipt Re-saved!',
            `New receipt image saved in Gallery (AlFalah Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select latest receipt → Send`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Resend failed:', error);
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image dobara save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdropFade, { opacity }]} />
      </Pressable>

      <View style={styles.center}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }], opacity }]}>
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <MaterialIcons name="close" size={20} color="#64748B" />
          </Pressable>

          {/* RECEIPT — Dark Indigo Card */}
          <View ref={receiptRef} collapsable={false} style={styles.receipt}>
            {/* ── 1. System Header: AL-FALAH CREDIT SYSTEM ── */}
            <View style={styles.receiptSystemHeader}>
              <View style={styles.systemHeaderIconWrap}>
                <MaterialIcons name="account-balance" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.receiptSystemTitle}>AL-FALAH CREDIT SYSTEM</Text>
            </View>

            {/* ── 2. Company Name ── */}
            <Text style={styles.receiptCompanyName}>{companyName || 'Finexa Recovery App'}</Text>

            {/* ── 3. Payment Receipt Label ── */}
            <Text style={styles.receiptPaymentLabel}>Payment Receipt</Text>

            {/* ── 4. Distributor Number ── */}
            {distributorPhone ? (
              <View style={styles.receiptDistPhoneRow}>
                <MaterialIcons name="call" size={14} color="#A7F3D0" />
                <Text style={styles.receiptDistPhoneLabel}>Distributor No:</Text>
                <Text style={styles.receiptDistPhoneValue}>{distributorPhone}</Text>
              </View>
            ) : null}

            {/* ── Divider ── */}
            <View style={styles.receiptDivider} />

            {/* ── 5. Shop Details ── */}
            <View style={styles.receiptShopSection}>
              <View style={styles.receiptInfoRow}>
                <MaterialIcons name="store" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.receiptInfoLabel}>Shop:</Text>
                <Text style={styles.receiptInfoValue}>{shopName}</Text>
              </View>
              {shopAddress ? (
                <View style={styles.receiptInfoRow}>
                  <MaterialIcons name="location-on" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.receiptInfoLabel}>Address:</Text>
                  <Text style={styles.receiptInfoValue}>{shopAddress}</Text>
                </View>
              ) : null}
              {shopOwnerName ? (
                <View style={styles.receiptInfoRow}>
                  <MaterialIcons name="person" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.receiptInfoLabel}>Owner:</Text>
                  <Text style={styles.receiptInfoValue}>{shopOwnerName}</Text>
                </View>
              ) : null}
              {shopPhone ? (
                <View style={styles.receiptInfoRow}>
                  <MaterialIcons name="call" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.receiptInfoLabel}>Phone:</Text>
                  <Text style={styles.receiptInfoValue}>{shopPhone}</Text>
                </View>
              ) : null}
              <View style={styles.receiptInfoRow}>
                <MaterialIcons name="calendar-today" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.receiptInfoLabel}>Date:</Text>
                <Text style={styles.receiptInfoValue}>{today}, {timeNow}</Text>
              </View>
            </View>

            {/* ── 6. Orderbooker Name ── */}
            {orderbookerName ? (
              <View style={styles.receiptOrderbookerSection}>
                <MaterialIcons name="badge" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.receiptOrderbookerLabel}>Orderbooker:</Text>
                <Text style={styles.receiptOrderbookerValue}>{orderbookerName}</Text>
              </View>
            ) : null}

            {/* ── 7. Balance Details ── */}
            <View style={styles.receiptAmountBox}>
              <View style={styles.receiptAmountRow}>
                <Text style={styles.receiptAmountLabel}>Opening Balance</Text>
                <Text style={styles.receiptAmountVal}>{formatPKR(openingBalance)}</Text>
              </View>
              <View style={styles.receiptAmtSep} />
              <View style={styles.receiptAmountRow}>
                <Text style={styles.receiptAmountLabel}>Payment Received</Text>
                <Text style={[styles.receiptAmountVal, { color: '#A7F3D0' }]}>{formatPKR(recoveryAmount)}</Text>
              </View>
              <View style={styles.receiptAmtSep} />
              <View style={[styles.receiptAmountRow, styles.receiptRemainingRow]}>
                <Text style={[styles.receiptAmountLabel, { color: '#FFFFFF', fontWeight: FontWeight.bold }]}>Remaining Balance</Text>
                <Text style={[styles.receiptAmountVal, { color: '#FDE68A', fontSize: 20 }]}>{formatPKR(remainingBalance)}</Text>
              </View>
            </View>

            {/* ── 8. Thank You ── */}
            <View style={styles.receiptThankYou}>
              <MaterialIcons name="verified" size={16} color="#A7F3D0" />
              <Text style={styles.receiptThankText}>Thank you for your Payment!</Text>
            </View>

            {/* ── 9. Urdu Hidayat with Distributor Number ── */}
            <View style={styles.receiptHidayat}>
              <Text style={styles.receiptHidayatText}>
                اگر آپ کو کسی بھی قسم کا کوئی فرق محسوس ہوتا ہے بیلنس میں تو اوپر دیے گئے نمبر پر لازمی رابطہ کریں شکریہ
              </Text>
            </View>

            {/* ── 10. Finexa Footer ── */}
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>Powered by Finexa Credit System</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsRow}>
            {/* WhatsApp button */}
            <Pressable
              style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.85 }]}
              onPress={handleShareImage}
              disabled={isCapturing}
            >
              <MaterialIcons name="chat" size={18} color="#25D366" />
              <Text style={styles.waBtnText}>WhatsApp</Text>
            </Pressable>

            {/* Save / Share button */}
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                isCapturing && styles.shareBtnDisabled,
                pressed && !isCapturing && { opacity: 0.85 },
              ]}
              onPress={savedImageUri ? handleResend : handleShareImage}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name={savedImageUri ? 'save' : 'share'} size={18} color="#FFFFFF" />
              )}
              <Text style={styles.shareBtnText}>
                {isCapturing ? 'Saving...' : savedImageUri ? 'Save Again' : 'Share Receipt'}
              </Text>
            </Pressable>
          </View>

          {/* Resend link */}
          {savedImageUri ? (
            <Pressable
              style={({ pressed }) => [styles.resendRow, pressed && { opacity: 0.7 }]}
              onPress={handleResend}
              disabled={isCapturing}
            >
              <MaterialIcons name="refresh" size={14} color="#94A3B8" />
              <Text style={styles.resendText}>Re-send Receipt</Text>
            </Pressable>
          ) : null}

          {/* Gallery saved indicator */}
          {imageSavedToGallery ? (
            <View style={styles.savedIndicator}>
              <MaterialIcons name="check-circle" size={14} color="#10B981" />
              <Text style={styles.savedText}>Receipt saved in Gallery (AlFalah Receipts)</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 1,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  // ===== RECEIPT — Dark Indigo Card =====
  receipt: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#4338CA',
    ...Shadow.xl,
  },

  // System header: AL-FALAH CREDIT SYSTEM
  receiptSystemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  systemHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  receiptSystemTitle: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  // Company name
  receiptCompanyName: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#A7F3D0',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 4,
  },

  // Payment Receipt label
  receiptPaymentLabel: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },

  // Distributor phone row
  receiptDistPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  receiptDistPhoneLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: FontWeight.medium,
  },
  receiptDistPhoneValue: {
    fontSize: 15,
    color: '#A7F3D0',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },

  // Divider
  receiptDivider: {
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 24,
    marginBottom: 10,
  },

  // Shop details section
  receiptShopSection: {
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  receiptInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  receiptInfoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: FontWeight.medium,
    width: 70,
  },
  receiptInfoValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },

  // Orderbooker section
  receiptOrderbookerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  receiptOrderbookerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: FontWeight.medium,
  },
  receiptOrderbookerValue: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },

  // Amount box
  receiptAmountBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: Radius.lg,
    padding: 14,
    marginHorizontal: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  receiptAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  receiptAmountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FontWeight.medium,
  },
  receiptAmountVal: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  receiptAmtSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 3,
  },
  receiptRemainingRow: {
    backgroundColor: 'rgba(250,204,21,0.1)',
    marginHorizontal: -14,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    marginTop: 4,
  },

  // Thank you section
  receiptThankYou: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  receiptThankText: {
    fontSize: 14,
    color: '#A7F3D0',
    fontWeight: FontWeight.semibold,
  },

  // Urdu Hidayat
  receiptHidayat: {
    marginHorizontal: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  receiptHidayatText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Finexa Footer
  receiptFooter: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  receiptFooterText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },

  // ===== ACTION BUTTONS =====
  buttonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  // WhatsApp button — green pill outline style
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 30,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  waBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#25D366',
  },
  // Share/Save button — gradient indigo pill
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4338CA',
    borderRadius: 30,
    paddingVertical: 13,
    ...Shadow.md,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  // Resend row
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  resendText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    color: '#94A3B8',
  },
  // Gallery saved indicator
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  savedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: FontWeight.medium,
  },
});

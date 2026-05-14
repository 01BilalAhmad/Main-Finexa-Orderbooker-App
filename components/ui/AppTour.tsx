// Finexa Orderbooker
// Feature 14: App Tour / First-Time Walkthrough
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

interface AppTourProps {
  visible: boolean;
  onComplete: () => void;
}

interface TourStep {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Finexa!',
    description: 'This is your Route screen where you manage daily shop visits and recoveries.',
    icon: 'waving-hand',
  },
  {
    title: 'Collect Recovery',
    description: 'Tap "Collect Recovery" on any shop card to submit a payment recovery.',
    icon: 'payments',
  },
  {
    title: 'GPS Verification',
    description: 'GPS verification automatically marks your shop visits when you\'re nearby.',
    icon: 'location-on',
  },
  {
    title: 'Ledger',
    description: 'Check the Ledger tab for detailed account statements and transaction history.',
    icon: 'receipt-long',
  },
  {
    title: 'Your Performance',
    description: 'The Profile tab shows your recovery performance and daily stats.',
    icon: 'speed',
  },
];

export function AppTour({ visible, onComplete }: AppTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      animateIn();
    }
  }, [visible]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        setCurrentStep((s) => s + 1);
        animateIn();
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onComplete();
    });
  };

  const step = STEPS[currentStep];

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        {/* Spotlight circle */}
        <View style={styles.spotlightContainer}>
          <View style={styles.spotlightCircle}>
            <MaterialIcons name={step.icon} size={48} color={Colors.primary} />
          </View>
        </View>

        {/* Content card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.stepIndicator}>
            Step {currentStep + 1} of {STEPS.length}
          </Text>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, idx === currentStep && styles.dotActive]}
              />
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextText}>
                {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
              </Text>
              {currentStep < STEPS.length - 1 ? (
                <MaterialIcons name="arrow-forward" size={16} color={Colors.textInverse} />
              ) : null}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  spotlightContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  spotlightCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  card: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
  },
  nextText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textInverse,
  },
});

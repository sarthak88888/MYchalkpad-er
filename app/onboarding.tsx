import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/lib/theme';

const { width, height } = Dimensions.get('window');

interface Slide {
  icon: string;
  iconColor: string;
  bgColor: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'school',
    iconColor: '#FFFFFF',
    bgColor: COLORS.primary,
    title: 'Welcome to MyChalkPad',
    subtitle: 'The complete school management solution for Indian schools — built for principals, teachers, parents and more.',
  },
  {
    icon: 'clipboard-check',
    iconColor: '#3B82F6',
    bgColor: '#EFF6FF',
    title: 'Attendance in Seconds',
    subtitle: 'Mark daily attendance with one tap. Automatic SMS alerts to parents for absences. Works offline too.',
  },
  {
    icon: 'cash-multiple',
    iconColor: '#10B981',
    bgColor: '#ECFDF5',
    title: 'Fee Management',
    subtitle: 'Collect fees online via Razorpay or UPI, track defaulters, send reminders and export reports instantly.',
  },
  {
    icon: 'message-text',
    iconColor: '#8B5CF6',
    bgColor: '#F5F3FF',
    title: 'Communicate Easily',
    subtitle: 'Send bulk SMS and WhatsApp messages in Hindi, Punjabi, Kangri or English with one tap.',
  },
  {
    icon: 'chart-bar',
    iconColor: COLORS.accent,
    bgColor: '#FFF7ED',
    title: 'Insights & Reports',
    subtitle: 'UDISE export, rankings, progress reports, dropout tracking — everything government compliance needs.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotScale = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1.4 : 1))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  function goToSlide(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    animateDot(index);
    setCurrentIndex(index);
  }

  function animateDot(index: number) {
    dotScale.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === index ? 1.4 : 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();
    });
  }

  function handleScroll(e: any) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
      animateDot(index);
    }
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      router.replace('/phone-auth');
    }
  }

  const slide = SLIDES[currentIndex];

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.slidesScroll}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { backgroundColor: s.bgColor, width }]}>
            <View style={[styles.iconContainer, { backgroundColor: s.iconColor === '#FFFFFF' ? COLORS.primary : s.iconColor + '20' }]}>
              <MaterialCommunityIcons name={s.icon as any} size={72} color={s.iconColor === '#FFFFFF' ? '#FFFFFF' : s.iconColor} />
            </View>
            <Text style={[styles.slideTitle, { color: s.bgColor === COLORS.primary ? '#FFFFFF' : COLORS.textPrimary }]}>
              {s.title}
            </Text>
            <Text style={[styles.slideSubtitle, { color: s.bgColor === COLORS.primary ? 'rgba(255,255,255,0.75)' : COLORS.textSecondary }]}>
              {s.subtitle}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { backgroundColor: slide.bgColor }]}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  transform: [{ scale: dotScale[i] }],
                  backgroundColor: i === currentIndex
                    ? (slide.bgColor === COLORS.primary ? '#FFFFFF' : COLORS.primary)
                    : (slide.bgColor === COLORS.primary ? 'rgba(255,255,255,0.3)' : COLORS.border),
                  width: i === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.replace('/phone-auth')}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: slide.bgColor === COLORS.primary ? 'rgba(255,255,255,0.6)' : COLORS.textSecondary }]}>
              Skip
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: slide.bgColor === COLORS.primary ? '#FFFFFF' : COLORS.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, { color: slide.bgColor === COLORS.primary ? COLORS.primary : '#FFFFFF' }]}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <MaterialCommunityIcons
              name={currentIndex === SLIDES.length - 1 ? 'check' : 'arrow-right'}
              size={18}
              color={slide.bgColor === COLORS.primary ? COLORS.primary : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* App version */}
        <Text style={[styles.versionText, { color: slide.bgColor === COLORS.primary ? 'rgba(255,255,255,0.3)' : COLORS.border }]}>
          MyChalkPad v1.0.0
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slidesScroll: { flex: 1 },
  slide: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 80,
    height: height * 0.72,
  },
  iconContainer: {
    width: 140, height: 140, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 40,
  },
  slideTitle: {
    fontSize: 28, fontWeight: 'bold', textAlign: 'center',
    lineHeight: 34, marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 8,
  },
  bottomControls: {
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20,
    height: height * 0.28,
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  dot: { height: 8, borderRadius: 4 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  skipText: { fontSize: 15, fontWeight: '500' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 30, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4,
  },
  nextBtnText: { fontSize: 16, fontWeight: 'bold' },
  versionText: { fontSize: 11, textAlign: 'center' },
});
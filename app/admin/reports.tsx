import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/lib/theme';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const REPORT_CARDS: ReportCard[] = [
  {
    id: '1',
    title: 'Report Cards',
    description: 'Subject-wise marks and CBSE grades',
    icon: 'file-certificate',
    color: '#3B82F6',
    route: '/admin/report-cards',
  },
  {
    id: '2',
    title: 'Rankings',
    description: 'Class and subject-wise student rankings',
    icon: 'podium',
    color: '#F59E0B',
    route: '/admin/rankings',
  },
  {
    id: '3',
    title: 'Progress Reports',
    description: 'Term-wise performance comparison',
    icon: 'trending-up',
    color: '#10B981',
    route: '/admin/progress-report',
  },
  {
    id: '4',
    title: 'Dropout Tracking',
    description: 'Monitor and reduce student dropouts',
    icon: 'account-remove',
    color: '#EF4444',
    route: '/admin/dropout-tracking',
  },
  {
    id: '5',
    title: 'UDISE Export',
    description: 'Government compliance data export',
    icon: 'export',
    color: '#8B5CF6',
    route: '/admin/udise-export',
  },
  {
    id: '6',
    title: 'Performance Ratings',
    description: 'Subject-wise student performance stars',
    icon: 'star-circle',
    color: '#F97316',
    route: '/admin/performance',
  },
];

export default function ReportsScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <Text style={styles.headerSubtitle}>
          Academic and administrative reports
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>SELECT A REPORT</Text>

        {REPORT_CARDS.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.reportCard}
            onPress={() => router.push(card.route as any)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: card.color + '18' },
              ]}
            >
              <MaterialCommunityIcons
                name={card.icon as any}
                size={32}
                color={card.color}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  scrollContent: { padding: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 14,
    marginTop: 4,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
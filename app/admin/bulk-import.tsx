// app/admin/bulk-import.tsx
// Bulk CSV Import Screen — Admin only
// Place this file in your app/admin/ folder

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';

import {
  importFromCSV,
  generateCSVTemplate,
  ImportUserRole,
  ImportResult,
} from '../../lib/csvImport';

// ─── Read school info from your SecureStore / auth context ───────────────────
// Replace these with however you currently read school info in your app
import { getValueFor } from '../../lib/storage'; // your existing SecureStore helper

// ─── ROLE OPTIONS ─────────────────────────────────────────────────────────────

const ROLES: { label: string; value: ImportUserRole; emoji: string; color: string }[] = [
  { label: 'Students + Parents', value: 'student',    emoji: '🎒', color: '#3B82F6' },
  { label: 'Teachers',           value: 'teacher',    emoji: '👩‍🏫', color: '#8B5CF6' },
  { label: 'Admins',             value: 'admin',      emoji: '🏫', color: '#1E3A5F' },
  { label: 'Accountants',        value: 'accountant', emoji: '💰', color: '#22C55E' },
  { label: 'Drivers',            value: 'driver',     emoji: '🚌', color: '#F97316' },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function BulkImportScreen() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<ImportUserRole | null>(null);
  const [fileName, setFileName]         = useState<string | null>(null);
  const [csvContent, setCsvContent]     = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<ImportResult | null>(null);

  // ── Pick CSV file ──────────────────────────────────────────────────────────

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const file = res.assets[0];

      // Validate it's a .csv file
      if (!file.name.toLowerCase().endsWith('.csv')) {
        Alert.alert('Wrong File', 'Please select a .csv file only.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      setFileName(file.name);
      setCsvContent(content);
      setResult(null); // clear previous result
    } catch (err) {
      Alert.alert('Error', 'Could not read file. Please try again.');
    }
  };

  // ── Download blank template ────────────────────────────────────────────────

  const downloadTemplate = async () => {
    if (!selectedRole) {
      Alert.alert('Select Type', 'Please select a user type first to download its template.');
      return;
    }

    try {
      const templateContent = generateCSVTemplate(selectedRole);
      const filePath = FileSystem.documentDirectory + `mychalkpad_template_${selectedRole}.csv`;

      await FileSystem.writeAsStringAsync(filePath, templateContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: `MyChalkPad ${selectedRole} CSV Template`,
        });
      } else {
        Alert.alert('Saved', `Template saved to: ${filePath}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not generate template.');
    }
  };

  // ── Run import ─────────────────────────────────────────────────────────────

  const runImport = async () => {
    if (!selectedRole) {
      Alert.alert('Select Type', 'Please select what type of users you are importing.');
      return;
    }
    if (!csvContent) {
      Alert.alert('No File', 'Please select a CSV file first.');
      return;
    }

    // Get school info from SecureStore
    const schoolId   = await getValueFor('school_id');
    const schoolName = await getValueFor('school_name') || 'Your School';

    if (!schoolId) {
      Alert.alert('Error', 'School ID not found. Please log out and log in again.');
      return;
    }

    // Confirm before running
    Alert.alert(
      'Start Import?',
      `This will import all ${selectedRole}s from "${fileName}" into Firestore and send SMS to each user.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            setResult(null);
            try {
              const importResult = await importFromCSV(
                csvContent,
                selectedRole,
                schoolId,
                schoolName
              );
              setResult(importResult);
            } catch (err: any) {
              Alert.alert(
                'Import Failed',
                err?.message || 'Something went wrong. Please check your CSV format.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bulk CSV Import</Text>
        <Text style={styles.subtitle}>
          Import 100s of users at once from a CSV file
        </Text>
      </View>

      {/* Step 1: Select Role */}
      <View style={styles.section}>
        <Text style={styles.stepLabel}>Step 1 — What are you importing?</Text>
        <View style={styles.roleGrid}>
          {ROLES.map(role => (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.roleCard,
                selectedRole === role.value && {
                  borderColor: role.color,
                  backgroundColor: role.color + '15',
                },
              ]}
              onPress={() => {
                setSelectedRole(role.value);
                setResult(null);
                setCsvContent(null);
                setFileName(null);
              }}
            >
              <Text style={styles.roleEmoji}>{role.emoji}</Text>
              <Text
                style={[
                  styles.roleLabel,
                  selectedRole === role.value && { color: role.color, fontWeight: '700' },
                ]}
              >
                {role.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Step 2: Download Template */}
      {selectedRole && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>Step 2 — Download blank template</Text>
          <Text style={styles.hint}>
            Send this template to the school. They fill it in and send it back.
          </Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={downloadTemplate}>
            <Text style={styles.outlineBtnText}>⬇  Download CSV Template</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 3: Upload filled CSV */}
      {selectedRole && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>Step 3 — Upload filled CSV</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickFile}>
            {fileName ? (
              <>
                <Text style={styles.uploadIcon}>✅</Text>
                <Text style={styles.uploadFileName}>{fileName}</Text>
                <Text style={styles.uploadTap}>Tap to change file</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadIcon}>📄</Text>
                <Text style={styles.uploadPrompt}>Tap to select CSV file</Text>
                <Text style={styles.uploadHint}>from Files / Downloads</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Step 4: Run Import */}
      {selectedRole && csvContent && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>Step 4 — Run Import</Text>
          <Text style={styles.hint}>
            This will add all users to Firestore and send them an SMS to download the app.
          </Text>
          <TouchableOpacity
            style={[styles.importBtn, loading && styles.importBtnDisabled]}
            onPress={runImport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.importBtnText}>🚀  Start Import</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>Import Result</Text>

          <View style={styles.resultBox}>
            <View style={styles.resultRow}>
              <View style={[styles.resultCard, { backgroundColor: '#22C55E20' }]}>
                <Text style={[styles.resultCount, { color: '#22C55E' }]}>
                  {result.success}
                </Text>
                <Text style={styles.resultLabel}>Imported ✅</Text>
              </View>
              <View style={[styles.resultCard, { backgroundColor: '#EF444420' }]}>
                <Text style={[styles.resultCount, { color: '#EF4444' }]}>
                  {result.failed}
                </Text>
                <Text style={styles.resultLabel}>Failed ❌</Text>
              </View>
            </View>

            {result.success > 0 && (
              <Text style={styles.smsNote}>
                📱 SMS sent to all {result.success} registered users
              </Text>
            )}
          </View>

          {/* Error list */}
          {result.errors.length > 0 && (
            <View style={styles.errorList}>
              <Text style={styles.errorTitle}>Failed Rows:</Text>
              {result.errors.map((err, idx) => (
                <View key={idx} style={styles.errorRow}>
                  <Text style={styles.errorRowText}>
                    Row {err.row} — <Text style={styles.errorName}>{err.name}</Text>
                  </Text>
                  <Text style={styles.errorReason}>{err.reason}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 12,
  },
  backText: {
    color: '#1E3A5F',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E3A5F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  section: {
    marginBottom: 28,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 10,
  },
  hint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleCard: {
    width: '47%',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  roleEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  outlineBtn: {
    borderWidth: 2,
    borderColor: '#1E3A5F',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  uploadIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  uploadPrompt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  uploadHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  uploadFileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
  },
  uploadTap: {
    fontSize: 12,
    color: '#94A3B8',
  },
  importBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  importBtnDisabled: {
    backgroundColor: '#FED7AA',
  },
  importBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  resultCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  resultCount: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  smsNote: {
    fontSize: 13,
    color: '#22C55E',
    textAlign: 'center',
    fontWeight: '600',
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  errorList: {
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorRowText: {
    fontSize: 13,
    color: '#7F1D1D',
  },
  errorName: {
    fontWeight: '700',
  },
  errorReason: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
});

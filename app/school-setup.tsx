import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, saveUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB', 'NIOS'];
const MEDIUM_OPTIONS = ['English', 'Hindi', 'Punjabi', 'Mixed'];

interface FormData {
  school_name: string;
  udise_code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  principal_name: string;
  board: string;
  medium: string;
  established_year: string;
}

export default function SchoolSetupScreen() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    school_name: '', udise_code: '', address: '', city: '',
    state: '', pincode: '', phone: '', email: '',
    principal_name: '', board: 'CBSE', medium: 'Hindi', established_year: '',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  function updateField(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  }

  function validateStep1(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.school_name.trim()) errs.school_name = 'School name is required';
    if (!form.udise_code.trim() || form.udise_code.trim().length < 8)
      errs.udise_code = 'Enter valid UDISE code (min 8 digits)';
    if (!form.principal_name.trim()) errs.principal_name = 'Principal name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.address.trim()) errs.address = 'Address is required';
    if (!form.city.trim()) errs.city = 'City is required';
    if (!form.state.trim()) errs.state = 'State is required';
    if (!form.pincode.trim() || form.pincode.trim().length !== 6)
      errs.pincode = 'Enter valid 6-digit PIN code';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleFinish() {
    if (!validateStep2()) return;
    setSaving(true);
    try {
      const session = await getUserSession();
      const phone = session.phone;

      // Generate school ID from UDISE code
      const schoolId = `school_${form.udise_code.trim()}`;

      // Create school document
      await setDoc(doc(db, 'schools', schoolId), {
        school_id: schoolId,
        school_name: form.school_name.trim(),
        udise_code: form.udise_code.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        principal_name: form.principal_name.trim(),
        board: form.board,
        medium: form.medium,
        established_year: form.established_year.trim(),
        created_at: new Date().toISOString(),
        created_by: phone,
      });

      // Create principal staff record
      await addDoc(collection(db, 'schools', schoolId, 'staff'), {
        name: form.principal_name.trim(),
        phone: phone,
        role: 'Principal',
        subject: 'Administration',
        salary: 0,
        joining_date: new Date().toISOString().split('T')[0],
        school_id: schoolId,
      });

      // Update session with school ID and admin role
      await saveUserSession({
        phone,
        name: form.principal_name.trim(),
        role: 'admin',
        schoolId,
      });

      router.replace('/admin');
    } catch (e: any) {
      Alert.alert('Setup Failed', e.message ?? 'Could not create school. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const INDIA_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>School Setup</Text>
        <Text style={styles.headerSub}>Step {step} of 2</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Basic Information</Text>
            <Text style={styles.stepSubtitle}>Tell us about your school</Text>

            <Text style={styles.fieldLabel}>School Name *</Text>
            <TextInput
              style={[styles.input, errors.school_name ? styles.inputErr : null]}
              placeholder="e.g. Government Senior Secondary School"
              placeholderTextColor={COLORS.textSecondary}
              value={form.school_name}
              onChangeText={v => updateField('school_name', v)}
            />
            {errors.school_name ? <Text style={styles.fieldError}>{errors.school_name}</Text> : null}

            <Text style={styles.fieldLabel}>UDISE Code *</Text>
            <TextInput
              style={[styles.input, errors.udise_code ? styles.inputErr : null]}
              placeholder="11-digit UDISE code"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              maxLength={11}
              value={form.udise_code}
              onChangeText={v => updateField('udise_code', v)}
            />
            {errors.udise_code ? <Text style={styles.fieldError}>{errors.udise_code}</Text> : null}

            <Text style={styles.fieldLabel}>Principal Name *</Text>
            <TextInput
              style={[styles.input, errors.principal_name ? styles.inputErr : null]}
              placeholder="Full name of principal"
              placeholderTextColor={COLORS.textSecondary}
              value={form.principal_name}
              onChangeText={v => updateField('principal_name', v)}
            />
            {errors.principal_name ? <Text style={styles.fieldError}>{errors.principal_name}</Text> : null}

            <Text style={styles.fieldLabel}>Board *</Text>
            <View style={styles.chipRow}>
              {BOARD_OPTIONS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, form.board === b && styles.chipActive]}
                  onPress={() => updateField('board', b)}
                >
                  <Text style={[styles.chipText, form.board === b && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Medium of Instruction *</Text>
            <View style={styles.chipRow}>
              {MEDIUM_OPTIONS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, form.medium === m && styles.chipActive]}
                  onPress={() => updateField('medium', m)}
                >
                  <Text style={[styles.chipText, form.medium === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Established Year</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1985"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              maxLength={4}
              value={form.established_year}
              onChangeText={v => updateField('established_year', v)}
            />

            <Text style={styles.fieldLabel}>School Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="School contact number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={v => updateField('phone', v)}
            />

            <Text style={styles.fieldLabel}>School Email</Text>
            <TextInput
              style={styles.input}
              placeholder="School email address"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={v => updateField('email', v)}
            />

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => { if (validateStep1()) setStep(2); }}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Next: Location</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stepTitle}>School Location</Text>
            <Text style={styles.stepSubtitle}>Address and contact details</Text>

            <Text style={styles.fieldLabel}>Full Address *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }, errors.address ? styles.inputErr : null]}
              placeholder="Street address, village/town, landmark"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={form.address}
              onChangeText={v => updateField('address', v)}
            />
            {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}

            <Text style={styles.fieldLabel}>City / Town *</Text>
            <TextInput
              style={[styles.input, errors.city ? styles.inputErr : null]}
              placeholder="City or town name"
              placeholderTextColor={COLORS.textSecondary}
              value={form.city}
              onChangeText={v => updateField('city', v)}
            />
            {errors.city ? <Text style={styles.fieldError}>{errors.city}</Text> : null}

            <Text style={styles.fieldLabel}>State *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.chipRow}>
                {INDIA_STATES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, form.state === s && styles.chipActive]}
                    onPress={() => updateField('state', s)}
                  >
                    <Text style={[styles.chipText, form.state === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {errors.state ? <Text style={styles.fieldError}>{errors.state}</Text> : null}

            <Text style={styles.fieldLabel}>PIN Code *</Text>
            <TextInput
              style={[styles.input, errors.pincode ? styles.inputErr : null]}
              placeholder="6-digit PIN code"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              maxLength={6}
              value={form.pincode}
              onChangeText={v => updateField('pincode', v)}
            />
            {errors.pincode ? <Text style={styles.fieldError}>{errors.pincode}</Text> : null}

            <View style={styles.stepTwoButtons}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep(1)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color={COLORS.primary} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.finishBtn, saving && { opacity: 0.6 }]}
                onPress={handleFinish}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.finishBtnText}>Create School</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  progressBar: { height: 4, backgroundColor: COLORS.border },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  scrollContent: { padding: 16 },
  stepTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 8, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  inputErr: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  stepTwoButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  backBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 14 },
  backBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  finishBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 14 },
  finishBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});



### `firestore.rules`

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper Functions ────────────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function getPhone() {
      return request.auth.token.phone_number.replace('+91', '');
    }

    function isStaff(schoolId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/schools/$(schoolId)/staff/$(request.auth.uid));
    }

    function getStaffData(schoolId) {
      return get(/databases/$(database)/documents/schools/$(schoolId)/staff/$(request.auth.uid)).data;
    }

    function isPrincipal(schoolId) {
      return isStaff(schoolId) &&
        getStaffData(schoolId).role in ['Principal', 'Vice Principal'];
    }

    function isClassTeacher(schoolId) {
      return isStaff(schoolId) &&
        getStaffData(schoolId).role in ['Class Teacher', 'Subject Teacher'];
    }

    function isAccountant(schoolId) {
      return isStaff(schoolId) &&
        getStaffData(schoolId).role == 'Accountant';
    }

    function isDriver(schoolId) {
      return isStaff(schoolId) &&
        getStaffData(schoolId).role == 'Bus Driver';
    }

    function isParentOf(schoolId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/schools/$(schoolId)/students/$(request.auth.uid));
    }

    // ── Schools ─────────────────────────────────────────────────────────────
    match /schools/{schoolId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isPrincipal(schoolId);
      allow delete: if false;

      // ── Students ──────────────────────────────────────────────────────────
      match /students/{studentId} {
        allow read: if isPrincipal(schoolId)
          || isClassTeacher(schoolId)
          || isAccountant(schoolId)
          || isDriver(schoolId)
          || (isSignedIn() && resource.data.parent_phone == getPhone());
        allow create: if isPrincipal(schoolId);
        allow update: if isPrincipal(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Staff ─────────────────────────────────────────────────────────────
      match /staff/{staffId} {
        allow read: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow create: if isPrincipal(schoolId);
        allow update: if isPrincipal(schoolId)
          || (isStaff(schoolId) && staffId == request.auth.uid);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Attendance ────────────────────────────────────────────────────────
      match /attendance/{recordId} {
        allow read: if isPrincipal(schoolId)
          || isClassTeacher(schoolId)
          || (isSignedIn() && resource.data.parent_phone == getPhone());
        allow create: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow update: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Fees ──────────────────────────────────────────────────────────────
      match /fees/{feeId} {
        allow read: if isPrincipal(schoolId)
          || isAccountant(schoolId)
          || (isSignedIn() && resource.data.student_id != null);
        allow create: if isPrincipal(schoolId) || isAccountant(schoolId);
        allow update: if isPrincipal(schoolId) || isAccountant(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Marks ─────────────────────────────────────────────────────────────
      match /marks/{markId} {
        allow read: if isPrincipal(schoolId)
          || isClassTeacher(schoolId)
          || isSignedIn();
        allow create: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow update: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Complaints ────────────────────────────────────────────────────────
      match /complaints/{complaintId} {
        allow read: if isPrincipal(schoolId)
          || (isSignedIn() && resource.data.submitted_by_phone == getPhone());
        allow create: if isSignedIn();
        allow update: if isPrincipal(schoolId)
          || (isSignedIn() && resource.data.submitted_by_phone == getPhone()
              && request.resource.data.status == resource.data.status);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Admissions ────────────────────────────────────────────────────────
      match /admissions/{admissionId} {
        allow read: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow create: if isSignedIn();
        allow update: if isPrincipal(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Timetables ────────────────────────────────────────────────────────
      match /timetables/{ttId} {
        allow read: if isPrincipal(schoolId)
          || isClassTeacher(schoolId)
          || isSignedIn();
        allow write: if isPrincipal(schoolId);
      }

      // ── PTM Meetings ──────────────────────────────────────────────────────
      match /ptm_meetings/{ptmId} {
        allow read: if isSignedIn();
        allow write: if isPrincipal(schoolId) || isClassTeacher(schoolId);
      }

      // ── Transfer Certificates ─────────────────────────────────────────────
      match /transfer_certificates/{tcId} {
        allow read: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow create: if isPrincipal(schoolId);
        allow update: if isPrincipal(schoolId);
        allow delete: if false;
      }

      // ── Dropouts ──────────────────────────────────────────────────────────
      match /dropouts/{dropoutId} {
        allow read: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow create: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow update: if isPrincipal(schoolId);
        allow delete: if isPrincipal(schoolId);
      }

      // ── Inspection Checklist ──────────────────────────────────────────────
      match /inspection/{docId} {
        allow read: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow write: if isPrincipal(schoolId);
      }

      // ── Performance Ratings ───────────────────────────────────────────────
      match /performance_ratings/{ratingId} {
        allow read: if isPrincipal(schoolId)
          || isClassTeacher(schoolId)
          || isSignedIn();
        allow write: if isPrincipal(schoolId) || isClassTeacher(schoolId);
      }

      // ── SMS Logs ──────────────────────────────────────────────────────────
      match /sms_logs/{logId} {
        allow read: if isPrincipal(schoolId);
        allow create: if isPrincipal(schoolId) || isClassTeacher(schoolId);
        allow update: if false;
        allow delete: if false;
      }

      // ── Rankings (computed) ───────────────────────────────────────────────
      match /rankings/{rankId} {
        allow read: if isSignedIn();
        allow write: if isPrincipal(schoolId) || isClassTeacher(schoolId);
      }
    }
  }
}
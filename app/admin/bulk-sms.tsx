import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { sendBulkSMS } from '@/lib/fast2sms';
import { sendBulkWhatsApp } from '@/lib/whatsapp';
import { COLORS } from '@/lib/theme';

const CLASS_OPTIONS = ['All Classes','6','7','8','9','10','11','12'];
const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'Hindi' },
  { key: 'pa', label: 'Punjabi' },
  { key: 'kangri', label: 'Kangri' },
  { key: 'haryanvi', label: 'Haryanvi' },
] as const;

const MESSAGE_TEMPLATES = [
  {
    type: 'Attendance Alert',
    icon: 'clipboard-check',
    message: 'Dear Parent, your child was absent today. Please ensure regular attendance. For details, contact the school.',
  },
  {
    type: 'Fee Reminder',
    icon: 'cash',
    message: 'Dear Parent, school fees are pending for your child. Please pay at the earliest to avoid late charges.',
  },
  {
    type: 'General Notice',
    icon: 'bullhorn',
    message: 'Important notice from school: ',
  },
  {
    type: 'PTM Notice',
    icon: 'account-group',
    message: 'Dear Parent, PTM meeting is scheduled. Please attend on the given date and time. Contact school for details.',
  },
];

type ChannelType = 'sms' | 'whatsapp' | 'both';
type LanguageType = 'en' | 'hi' | 'pa' | 'kangri' | 'haryanvi';

export default function BulkSMSScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageType>('en');
  const [channel, setChannel] = useState<ChannelType>('sms');
  const [message, setMessage] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [phones, setPhones] = useState<string[]>([]);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { loadRecipients(); }, [selectedClass, schoolId]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function loadRecipients() {
    setLoading(true);
    try {
      let snap;
      if (selectedClass === 'All Classes') {
        snap = await getDocs(collection(db, 'schools', schoolId, 'students'));
      } else {
        snap = await getDocs(query(
          collection(db, 'schools', schoolId, 'students'),
          where('class', '==', selectedClass)
        ));
      }
      const allPhones = snap.docs
        .map(d => d.data().parent_phone as string)
        .filter(p => p && p.length === 10);
      const unique = [...new Set(allPhones)];
      setPhones(unique);
      setRecipientCount(unique.length);
    } catch (e) {
      console.error('Load recipients error:', e);
    } finally {
      setLoading(false);
    }
  }

  function estimatedCost(): string {
    const baseRate = 0.15;
    const count = channel === 'both' ? recipientCount * 2 : recipientCount;
    return `₹${(count * baseRate).toFixed(2)}`;
  }

  async function handleSend() {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }
    if (phones.length === 0) {
      Alert.alert('No Recipients', 'No parent phone numbers found.');
      return;
    }
    Alert.alert(
      'Confirm Send',
      `Send ${channel === 'both' ? 'SMS + WhatsApp' : channel.toUpperCase()} to ${recipientCount} parents?\n\nEstimated cost: ${estimatedCost()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Now', onPress: executeSend },
      ]
    );
  }

  async function executeSend() {
    setSending(true);
    try {
      let smsSent = 0, smsF = 0, waSent = 0, waF = 0;

      if (channel === 'sms' || channel === 'both') {
        const result = await sendBulkSMS(phones, message, selectedLanguage);
        smsSent = result.sent;
        smsF = result.failed;
      }

      if (channel === 'whatsapp' || channel === 'both') {
        const result = await sendBulkWhatsApp(phones, message);
        waSent = result.sent;
        waF = result.failed;
      }

      await addDoc(collection(db, 'schools', schoolId, 'sms_logs'), {
        recipient_phone: 'bulk',
        recipient_name: `Bulk to ${selectedClass}`,
        message: message.trim(),
        language: selectedLanguage,
        channel,
        status: 'sent',
        sent_at: new Date().toISOString(),
        school_id: schoolId,
      });

      let resultMsg = '';
      if (channel === 'sms') resultMsg = `SMS: ${smsSent} sent, ${smsF} failed`;
      else if (channel === 'whatsapp') resultMsg = `WhatsApp: ${waSent} sent, ${waF} failed`;
      else resultMsg = `SMS: ${smsSent} sent\nWhatsApp: ${waSent} sent`;

      Alert.alert('Messages Sent!', resultMsg);
      setMessage('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send messages.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bulk SMS / WhatsApp</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Class Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SELECT CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CLASS_OPTIONS.map(cls => (
              <TouchableOpacity
                key={cls}
                style={[styles.chip, selectedClass === cls && styles.chipActive]}
                onPress={() => setSelectedClass(cls)}
              >
                <Text style={[styles.chipText, selectedClass === cls && styles.chipTextActive]}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Language Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>LANGUAGE</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.key}
                style={[styles.langChip, selectedLanguage === lang.key && styles.langChipActive]}
                onPress={() => setSelectedLanguage(lang.key)}
              >
                <Text style={[styles.langChipText, selectedLanguage === lang.key && styles.langChipTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message Templates */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>QUICK TEMPLATES</Text>
          <View style={styles.templatesGrid}>
            {MESSAGE_TEMPLATES.map(t => (
              <TouchableOpacity
                key={t.type}
                style={styles.templateChip}
                onPress={() => setMessage(t.message)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={t.icon as any} size={16} color={COLORS.primary} />
                <Text style={styles.templateChipText}>{t.type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message Input */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>MESSAGE</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Type your message here..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={5}
            value={message}
            onChangeText={setMessage}
          />
          <Text style={styles.charCount}>{message.length} characters</Text>
        </View>

        {/* Channel Toggle */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SEND VIA</Text>
          <View style={styles.channelRow}>
            {(['sms', 'whatsapp', 'both'] as ChannelType[]).map(ch => (
              <TouchableOpacity
                key={ch}
                style={[styles.channelChip, channel === ch && styles.channelChipActive]}
                onPress={() => setChannel(ch)}
              >
                <MaterialCommunityIcons
                  name={ch === 'whatsapp' ? 'whatsapp' : ch === 'sms' ? 'message-text' : 'message-fast'}
                  size={16}
                  color={channel === ch ? '#FFFFFF' : COLORS.textSecondary}
                />
                <Text style={[styles.channelChipText, channel === ch && styles.channelChipTextActive]}>
                  {ch === 'both' ? 'Both' : ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <MaterialCommunityIcons name="account-multiple" size={20} color={COLORS.primary} />
            <Text style={styles.previewLabel}>Recipients:</Text>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.previewValue}>{recipientCount} parents</Text>
            )}
          </View>
          <View style={styles.previewRow}>
            <MaterialCommunityIcons name="cash" size={20} color={COLORS.success} />
            <Text style={styles.previewLabel}>Est. Cost:</Text>
            <Text style={[styles.previewValue, { color: COLORS.success }]}>{estimatedCost()}</Text>
          </View>
          <View style={styles.previewRow}>
            <MaterialCommunityIcons
              name={channel === 'whatsapp' ? 'whatsapp' : 'message-text'}
              size={20}
              color={channel === 'whatsapp' ? '#16A34A' : COLORS.primary}
            />
            <Text style={styles.previewLabel}>Channel:</Text>
            <Text style={styles.previewValue}>
              {channel === 'both' ? 'SMS + WhatsApp' : channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </Text>
          </View>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, (sending || loading || !message.trim()) && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending || loading || !message.trim()}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>Send Now</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  langChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langChipText: { fontSize: 13, color: COLORS.textSecondary },
  langChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary + '40', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS.primary + '08' },
  templateChipText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  messageInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary, height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  channelRow: { flexDirection: 'row', gap: 10 },
  channelChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  channelChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  channelChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  channelChipTextActive: { color: '#FFFFFF' },
  previewCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: COLORS.primary + '30', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  previewLabel: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  previewValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sendBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sendBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
});
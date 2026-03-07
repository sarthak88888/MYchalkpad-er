import { ViewStyle, TextStyle } from 'react-native';

export const COLORS = {
  primary: '#1E3A5F',
  accent: '#F97316',
  background: '#F8FAFC',
  card: '#FFFFFF',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F97316',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
} as const;

export const CARD_STYLE: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  elevation: 3,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  padding: 16,
  marginBottom: 12,
};

export const HEADER_STYLE: ViewStyle = {
  backgroundColor: '#1E3A5F',
  paddingTop: 48,
  paddingBottom: 16,
  paddingHorizontal: 16,
};

export const HEADER_TITLE_STYLE: TextStyle = {
  color: '#FFFFFF',
  fontSize: 20,
  fontWeight: 'bold',
};

export const BUTTON_PRIMARY: ViewStyle = {
  backgroundColor: '#1E3A5F',
  borderRadius: 8,
  paddingVertical: 14,
  alignItems: 'center',
};

export const BUTTON_ACCENT: ViewStyle = {
  backgroundColor: '#F97316',
  borderRadius: 8,
  paddingVertical: 14,
  alignItems: 'center',
};

export const BUTTON_TEXT_STYLE: TextStyle = {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 'bold',
};

export const INPUT_STYLE: ViewStyle & TextStyle = {
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
  color: '#1E293B',
  backgroundColor: '#FFFFFF',
};

export const STYLES = {
  card: CARD_STYLE,
  header: HEADER_STYLE,
  headerTitle: HEADER_TITLE_STYLE,
  button: BUTTON_PRIMARY,
  accentButton: BUTTON_ACCENT,
  buttonText: BUTTON_TEXT_STYLE,
  input: INPUT_STYLE,
} as const;
import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';

export async function sendSMS(
  phones: string[],
  message: string,
  language: 'en' | 'hi' | 'pa' | 'kangri' | 'haryanvi' = 'en'
): Promise<{ success: boolean; message: string; request_id?: string }> {
  const apiKey: string =
    Constants.expoConfig?.extra?.fast2smsApiKey ?? '';

  if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_FAST2SMS_KEY') {
    console.warn('Fast2SMS API key not configured');
    return { success: false, message: 'API key not configured' };
  }

  const cleanedPhones = phones
    .map((p) => p.replace(/\D/g, '').replace(/^91/, ''))
    .filter((p) => p.length === 10);

  if (cleanedPhones.length === 0) {
    return { success: false, message: 'No valid phone numbers provided' };
  }

  try {
    const response = await axios.post(
      BASE_URL,
      {
        route: 'q',
        message: message,
        language: language === 'en' ? 'english' : 'unicode',
        flash: 0,
        numbers: cleanedPhones.join(','),
      },
      {
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.return === true) {
      return {
        success: true,
        message: 'SMS sent successfully',
        request_id: response.data?.request_id,
      };
    } else {
      return {
        success: false,
        message: response.data?.message ?? 'SMS sending failed',
      };
    }
  } catch (error: any) {
    console.error('Fast2SMS error:', error?.response?.data ?? error.message);
    return {
      success: false,
      message: error?.response?.data?.message ?? 'Network error sending SMS',
    };
  }
}

export async function sendBulkSMS(
  phones: string[],
  message: string,
  language: 'en' | 'hi' | 'pa' | 'kangri' | 'haryanvi' = 'en'
): Promise<{ success: boolean; sent: number; failed: number }> {
  const BATCH_SIZE = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch = phones.slice(i, i + BATCH_SIZE);
    const result = await sendSMS(batch, message, language);
    if (result.success) {
      sent += batch.length;
    } else {
      failed += batch.length;
    }
  }

  return { success: failed === 0, sent, failed };
}
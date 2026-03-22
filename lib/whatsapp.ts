import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = 'https://api.interakt.ai/v1/public/message/';

export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const apiKey: string =
    Constants.expoConfig?.extra?.interaktApiKey ?? '';

  if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_INTERAKT_KEY') {
    console.warn('Interakt API key not configured');
    return { success: false, message: 'API key not configured' };
  }

  const cleanedPhone = phone.replace(/\D/g, '').replace(/^91/, '');

  if (cleanedPhone.length !== 10) {
    return { success: false, message: 'Invalid phone number' };
  }

  try {
    const response = await axios.post(
      BASE_URL,
      {
        countryCode: '+91',
        phoneNumber: cleanedPhone,
        callbackData: 'mychalkpad_notification',
        type: 'Text',
        data: {
          message: message,
        },
      },
      {
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200) {
      return { success: true, message: 'WhatsApp message sent' };
    } else {
      return {
        success: false,
        message: response.data?.message ?? 'WhatsApp sending failed',
      };
    }
  } catch (error: any) {
    console.error('Interakt error:', error?.response?.data ?? error.message);
    return {
      success: false,
      message: error?.response?.data?.message ?? 'Network error sending WhatsApp',
    };
  }
}

export async function sendBulkWhatsApp(
  phones: string[],
  message: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const phone of phones) {
    const result = await sendWhatsApp(phone, message);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { success: failed === 0, sent, failed };
}
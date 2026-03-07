import RazorpayCheckout from 'react-native-razorpay';
import Constants from 'expo-constants';

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  order_id?: string;
  signature?: string;
  error?: string;
}

export async function initiatePayment(
  amount: number,
  studentName: string,
  phone: string,
  description: string
): Promise<PaymentResult> {
  const keyId: string =
    Constants.expoConfig?.extra?.razorpayKeyId ?? '';

  if (!keyId || keyId === 'REPLACE_WITH_YOUR_RAZORPAY_KEY') {
    return {
      success: false,
      error: 'Razorpay key not configured. Please contact school administration.',
    };
  }

  const amountInPaise = Math.round(amount * 100);

  const options = {
    description: description,
    image: 'https://mychalkpad.com/logo.png',
    currency: 'INR',
    key: keyId,
    amount: amountInPaise,
    name: 'MyChalkPad',
    prefill: {
      contact: phone.replace(/\D/g, '').replace(/^91/, ''),
      name: studentName,
    },
    theme: { color: '#1E3A5F' },
    modal: {
      confirm_close: true,
    },
    notes: {
      student_name: studentName,
      description: description,
    },
  };

  return new Promise((resolve) => {
    RazorpayCheckout.open(options)
      .then((data: any) => {
        resolve({
          success: true,
          payment_id: data.razorpay_payment_id,
          order_id: data.razorpay_order_id,
          signature: data.razorpay_signature,
        });
      })
      .catch((error: any) => {
        if (error.code === 0) {
          resolve({ success: false, error: 'Payment cancelled by user' });
        } else {
          resolve({
            success: false,
            error: error.description ?? 'Payment failed. Please try again.',
          });
        }
      });
  });
}
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export async function registerForPushNotifications(
  phone: string
): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('EAS project ID not configured — skipping FCM registration');
      return;
    }

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const fcmToken = tokenData.data;

    const userRef = doc(db, 'users', phone);
    await setDoc(userRef, { fcm_token: fcmToken }, { merge: true });

    console.log('FCM token registered:', fcmToken);
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
  }
}

export async function sendAbsenceNotification(
  parentFcmToken: string,
  studentName: string,
  date: string
): Promise<void> {
  try {
    const message = {
      to: parentFcmToken,
      sound: 'default',
      title: 'Attendance Alert — MyChalkPad',
      body: `${studentName} was marked absent on ${date}. Please contact the school if this is incorrect.`,
      data: {
        type: 'absence_alert',
        student_name: studentName,
        date,
      },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

export async function sendFeeReminderNotification(
  parentFcmToken: string,
  studentName: string,
  amount: number,
  dueDate: string
): Promise<void> {
  try {
    const message = {
      to: parentFcmToken,
      sound: 'default',
      title: 'Fee Reminder — MyChalkPad',
      body: `Fee of ₹${amount} for ${studentName} is due on ${dueDate}. Please pay at the earliest.`,
      data: {
        type: 'fee_reminder',
        student_name: studentName,
        amount,
        due_date: dueDate,
      },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Error sending fee reminder notification:', error);
  }
}

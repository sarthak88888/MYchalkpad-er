# MyChalkPad — School ERP Mobile App 📚

A full-featured **School Management ERP** built as a cross-platform mobile application for Indian schools. MyChalkPad digitizes school operations — from attendance and fee collection to staff management and parent communication — all in one app.

---

## 🚀 Features

### 👨‍💼 Admin / Principal Dashboard
- Student & Staff management (add, edit, bulk-import via Excel/CSV)
- Attendance tracking with real-time reports
- Fee management with Razorpay payment integration
- Marks entry and auto-generated rankings
- Timetable builder
- UDISE export for government compliance
- Dropout tracking and follow-up tools
- Bulk SMS broadcasts via Fast2SMS
- Admission management and Transfer Certificate generation
- PTM (Parent-Teacher Meeting) scheduling
- Inspection preparation tools

### 👩‍🏫 Teacher Dashboard
- Class-wise attendance marking
- Marks entry per subject and exam type
- Student directory with profile view
- Personal timetable view

### 👨‍👩‍👧 Parent Dashboard
- Child's attendance overview
- Marks and result tracking
- Fee dues and payment history
- Complaint submission and tracking

### 🚌 Bus Driver Dashboard
- Assigned route and student list view

### 🧾 Accountant Dashboard
- Fee collection and reconciliation
- Financial reports

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native + Expo SDK 51 |
| Navigation | Expo Router v3 (file-based routing) |
| Language | TypeScript (strict mode) |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Auth | Custom OTP via Fast2SMS + AsyncStorage sessions |
| Payments | Razorpay SDK |
| Notifications | Expo Notifications |
| Local Auth | Expo Local Authentication (Biometrics) |
| Internationalisation | Custom i18n (Hindi + English) |

---

## 🏗️ Architecture

```
MyChalkPad/
├── app/
│   ├── admin/          # Admin/Principal screens
│   ├── teacher/        # Teacher screens
│   ├── parents/        # Parent screens
│   ├── driver/         # Bus Driver screens
│   ├── accountant/     # Accountant screens
│   ├── index.tsx       # Login / Entry point
│   ├── onboarding.tsx  # First-time school setup
│   └── phone-auth.tsx  # OTP authentication
├── lib/
│   ├── types.ts        # All TypeScript interfaces
│   ├── firebase.ts     # Firestore config
│   ├── fast2sms.ts     # SMS service
│   ├── razorpay.ts     # Payment integration
│   ├── i18n.ts         # Multilingual support
│   ├── storage.ts      # AsyncStorage session management
│   └── notifications.ts
└── components/
    ├── ui.tsx          # Shared UI components
    └── ErrorBoundary.tsx
```

**Auth Flow:** Phone Number → Firestore lookup → Fast2SMS OTP → Verify → AsyncStorage session → Role-based routing

**Roles supported:** Admin, Principal, Vice Principal, Class Teacher, Subject Teacher, Bus Driver, Accountant, Parent

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/MyChalkPad.git
cd MyChalkPad
npm install
```

### 2. Configure API Keys
Edit `app.json` → `expo.extra` and fill in:

```json
{
  "firebaseApiKey": "YOUR_KEY",
  "firebaseAuthDomain": "YOUR_PROJECT.firebaseapp.com",
  "firebaseProjectId": "YOUR_PROJECT_ID",
  "firebaseStorageBucket": "YOUR_PROJECT.appspot.com",
  "firebaseMessagingSenderId": "YOUR_SENDER_ID",
  "firebaseAppId": "YOUR_APP_ID",
  "fast2smsApiKey": "YOUR_FAST2SMS_KEY",
  "razorpayKeyId": "YOUR_RAZORPAY_KEY"
}
```

### 3. Add Firebase config
Place your `google-services.json` from Firebase Console in the project root.

### 4. Start Development
```bash
npx expo start
```

---

## 📦 Build

```bash
# Android APK (for testing)
eas build --profile preview --platform android

# Android AAB (for Play Store)
eas build --profile production-aab --platform android
```

---

## 📌 Key Design Decisions

- **No Firebase Phone Auth** — uses Fast2SMS OTP to avoid Google Play Services dependency on low-end Android devices common in Indian schools
- **Role-based routing** — each role gets a completely isolated navigator with separate screens and access controls
- **Offline-first sessions** — AsyncStorage sessions survive app restarts without re-authentication
- **Multilingual** — Hindi and English support built-in via custom i18n module
- **Biometric login** — optional fingerprint/Face ID after first OTP login

---

## 📄 License
MIT

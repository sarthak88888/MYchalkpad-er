# Google Play Data Safety — MyChalkPad Answers

Fill these answers in Google Play Console → App Content → Data Safety

## DOES YOUR APP COLLECT OR SHARE USER DATA?
Yes

## DATA TYPES COLLECTED:

### Personal Info
- Name: Yes — Collected, Not shared, Required, Encrypted
- Phone number: Yes — Collected, Not shared, Required, Encrypted
- User IDs: Yes — Collected, Not shared, Required, Encrypted

### Financial Info
- Purchase history: Yes — Collected, Not shared, Required, Encrypted
  (fee payment records)

### Location
- Approximate location: No
- Precise location: Yes — Collected, Not shared, Optional, Encrypted
  (bus driver GPS only, only when route is active)

### App Activity
- App interactions: No
- In-app search history: No
- Other user-generated content: Yes — messages/complaints, Collected, Not shared

### App Info and Performance
- Crash logs: Yes — Collected, Not shared (via Sentry, anonymized)

## IS DATA ENCRYPTED IN TRANSIT?
Yes — all data encrypted using TLS/HTTPS

## CAN USERS REQUEST DATA DELETION?
Yes — users can contact school admin or email privacy@mychalkpad.com

## DOES THE APP SHARE DATA WITH THIRD PARTIES?
Yes:
- Firebase/Google: Authentication and database (data processing)
- Razorpay: Payment processing (data processing)
- Fast2SMS: SMS delivery (phone numbers only)
- Interakt: WhatsApp delivery (phone numbers only)
- Sentry: Crash reporting (anonymized only)
```

---

**✅ FILE GROUP 1 COMPLETE**

**Folder/file summary for this group — paste everything in your project root:**
```
mychalkpad-erp/
├── package.json
├── app.json
├── eas.json
├── tsconfig.json
├── babel.config.js
├── firestore.rules
├── google-services.json
├── store-listing.md
├── privacy-policy.md
├── data-safety.md
└── scripts/
    └── generate-keystore.sh
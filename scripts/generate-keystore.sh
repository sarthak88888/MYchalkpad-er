#!/bin/bash
# =============================================================
# MYCHALKPAD — ANDROID KEYSTORE GENERATOR
# Run this ONCE before your first Play Store submission.
# KEEP the generated keystore file SAFE — you can never change
# it after uploading to Play Store.
# =============================================================
#
# HOW TO RUN:
#   chmod +x scripts/generate-keystore.sh
#   ./scripts/generate-keystore.sh
#
# WHAT IT DOES:
#   Creates mychalkpad-release.keystore in your project root
#   You must add this keystore to eas.json credentials
#
# AFTER RUNNING:
#   1. Copy the keystore file to a safe backup location
#   2. Save the passwords you entered — you need them forever
#   3. Run: eas credentials → upload this keystore to EAS
# =============================================================

keytool -genkey -v \
  -keystore mychalkpad-release.keystore \
  -alias mychalkpad \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=MyChalkPad, OU=Education, O=MyChalkPad, L=Dharamshala, ST=Himachal Pradesh, C=IN"

echo ""
echo "✅ Keystore created: mychalkpad-release.keystore"
echo "⚠️  BACK UP THIS FILE IMMEDIATELY — losing it means losing your app"
echo ""
echo "Next steps:"
echo "1. Run: eas credentials"
echo "2. Select Android → Upload keystore → select mychalkpad-release.keystore"
echo "3. Enter the passwords you just created"
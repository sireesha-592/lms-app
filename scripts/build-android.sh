#!/bin/bash
# ============================================================
#  LMS Android APK Builder
#  Prerequisites: Node.js, Java JDK 17+, Android Studio (with SDK)
#  Run from your lms-app root: bash scripts/build-android.sh
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}  LMS Android APK Builder${NC}"
echo -e "${CYAN}=====================================${NC}"
echo ""

# ── Check tools ────────────────────────────────────────────────────────────
command -v node  >/dev/null || { echo -e "${RED}ERROR: Node.js not found. Install from nodejs.org${NC}"; exit 1; }
command -v java  >/dev/null || { echo -e "${RED}ERROR: Java JDK not found. Install JDK 17 from adoptium.net${NC}"; exit 1; }
command -v npx   >/dev/null || { echo -e "${RED}ERROR: npx not found. Run: npm install -g npx${NC}"; exit 1; }

echo -e "${GREEN}✅ Node.js $(node -v) found${NC}"
echo -e "${GREEN}✅ Java $(java -version 2>&1 | head -1) found${NC}"

# ── Build React ─────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[Step 1] Building React frontend...${NC}"
cd frontend
npm install
REACT_APP_API_URL="http://YOUR_SERVER_IP:5000" npm run build
cd ..
echo -e "${GREEN}✅ Frontend built${NC}"

# ── Install Capacitor ────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[Step 2] Installing Capacitor...${NC}"
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android \
            @capacitor/splash-screen @capacitor/status-bar 2>/dev/null
cd ..
echo -e "${GREEN}✅ Capacitor installed${NC}"

# ═══════════════════════════════════════════════════════════════
#  BUILD FUNCTION – reused for each app
# ═══════════════════════════════════════════════════════════════
build_apk() {
  local APP_NAME="$1"
  local APP_ID="$2"
  local CONFIG_SRC="$3"
  local OUTPUT_APK="$4"

  echo ""
  echo -e "${CYAN}─────────────────────────────────${NC}"
  echo -e "${CYAN}  Building ${APP_NAME} APK${NC}"
  echo -e "${CYAN}─────────────────────────────────${NC}"

  cd frontend

  # Copy capacitor config for this app
  cp "../android/${CONFIG_SRC}" capacitor.config.ts

  # Initialise (skip if already done)
  if [ ! -d "android" ]; then
    npx cap init "${APP_NAME}" "${APP_ID}" --web-dir build
    npx cap add android
  fi

  # Sync web assets
  npx cap sync android

  # Build debug APK via Gradle
  cd android
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    ./gradlew.bat assembleDebug
  else
    chmod +x gradlew
    ./gradlew assembleDebug
  fi

  # Copy output
  APK_SRC=$(find . -name "*.apk" | grep -v "unsigned" | head -1)
  mkdir -p "../../dist-android"
  cp "$APK_SRC" "../../dist-android/${OUTPUT_APK}"
  echo -e "${GREEN}✅ ${OUTPUT_APK} created in dist-android/${NC}"

  # Clean android folder for next app
  cd ..
  rm -rf android
  cd ..
}

# ── Build each app ────────────────────────────────────────────────────────────
build_apk "LMS Admin"   "com.lms.admin"   "capacitor.config.admin.ts"   "LMS-Admin-v1.0.apk"
build_apk "LMS Trainer" "com.lms.trainer" "capacitor.config.trainer.ts" "LMS-Trainer-v1.0.apk"
build_apk "LMS Trainee" "com.lms.trainee" "capacitor.config.trainee.ts" "LMS-Trainee-v1.0.apk"

echo ""
echo -e "${CYAN}=====================================${NC}"
echo -e "${GREEN}  ALL APKs BUILT SUCCESSFULLY!${NC}"
echo -e "${CYAN}=====================================${NC}"
echo ""
echo "Your APK files are in: dist-android/"
echo "  LMS-Admin-v1.0.apk"
echo "  LMS-Trainer-v1.0.apk"
echo "  LMS-Trainee-v1.0.apk"
echo ""
echo -e "${YELLOW}To install on Android phone:${NC}"
echo "  1. Enable 'Install unknown apps' in phone settings"
echo "  2. Copy APK to phone via USB / Google Drive / WhatsApp"
echo "  3. Open APK file on phone → Install"

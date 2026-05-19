/*
 * APDC Attendance System - No OLED Version
 * ESP32 + MFRC522 Only
 * All output to Serial Monitor
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Credentials
const char* WIFI_SSID = "Hozwe";        // Change to your WiFi name
const char* WIFI_PASSWORD = "12345678"; // Change to your WiFi password

// Backend API URL
const char* API_URL = "https://thesisi-production.up.railway.app/api/nfc/scan.php";
// Example: "http://192.168.1.100/apdc/backend/api/nfc/scan.php"
// Find your IP: Open CMD → type "ipconfig" → look for IPv4 Address

// ============================================
// PIN DEFINITIONS
// ============================================

#define SS_PIN    5   // MFRC522 SDA
#define RST_PIN   22  // MFRC522 RST
#define BUZZER_PIN 4  // Passive Buzzer

// ============================================
// CREATE INSTANCES
// ============================================

MFRC522 mfrc522(SS_PIN, RST_PIN);

// ============================================
// BUZZER FUNCTIONS
// ============================================

// Use LEDC channel 0 for buzzer (avoids tone() channel exhaustion)
#define BUZZER_CHANNEL 0

void buzzerTone(int frequency, int duration) {
  ledcWriteTone(BUZZER_CHANNEL, frequency);
  delay(duration);
  ledcWriteTone(BUZZER_CHANNEL, 0);
}

void playSuccessSound() {
  // Two ascending tones - cheerful confirmation
  buzzerTone(1000, 150);
  delay(10);
  buzzerTone(1500, 150);
  delay(10);
  buzzerTone(2000, 200);
  delay(10);
}

void playAssignReadySound() {
  // Single neutral tone - card acknowledged, ready for assignment
  buzzerTone(800, 200);
  delay(10);
  buzzerTone(800, 200);
  delay(10);
}

void playFailSound() {
  // Long first beep then short low drop - clearly different from success
  buzzerTone(400, 500);
  delay(20);
  buzzerTone(250, 300);
  delay(10);
}

void playCardDetectedBeep() {
  // Short beep to acknowledge card read
  buzzerTone(1200, 80);
  delay(10);
}

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  // Initialize buzzer pin
  ledcSetup(BUZZER_CHANNEL, 2000, 8);  // channel 0, 2000Hz default, 8-bit resolution
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWriteTone(BUZZER_CHANNEL, 0);
  
  // Test buzzer on startup
  Serial.println("Testing buzzer...");
  ledcWriteTone(BUZZER_CHANNEL, 1000);
  delay(200);
  ledcWriteTone(BUZZER_CHANNEL, 0);
  delay(100);
  
  Serial.println("\n\n");
  Serial.println("================================");
  Serial.println("    APDC Attendance System");
  Serial.println("    ESP32 + MFRC522");
  Serial.println("    Serial Monitor Version");
  Serial.println("================================");
  Serial.println();
  
  // Initialize SPI
  SPI.begin();
  Serial.println("[1/3] Initializing SPI...");
  delay(500);
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  delay(500);
  mfrc522.PCD_Init();
  delay(100);

  Serial.println("[2/3] NFC Reader initialized ✓");
  
  // Test MFRC522
  Serial.println("Testing MFRC522...");
  mfrc522.PCD_Init();
  delay(100);
  
// 0x91 or 0x92 = genuine MFRC522
// 0x88 = clone (still works)
// 0x00 or 0xFF = no SPI communication
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("⚠️  WARNING: MFRC522 not detected!");
    Serial.println("    Check wiring:");
    Serial.println("    SDA  → GPIO 5");
    Serial.println("    SCK  → GPIO 18");
    Serial.println("    MOSI → GPIO 23");
    Serial.println("    MISO → GPIO 19");
    Serial.println("    RST  → GPIO 22");
    Serial.println("    GND  → GND");
    Serial.println("    3.3V → 3.3V");
    Serial.println();
  } else {
    Serial.print("    MFRC522 Version: 0x");
    Serial.println(version, HEX);
  }
  
  // Connect to WiFi
  Serial.println("[3/3] Connecting to WiFi...");
  connectWiFi();
  
  Serial.println();
  Serial.println("================================");
  Serial.println("🎯 SYSTEM READY!");
  Serial.println("   Waiting for NFC card...");
  Serial.println("================================");
  Serial.println();
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi disconnected! Reconnecting...");
    connectWiFi();
    return;
  }
  
  // Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  // Card detected!
  Serial.println("┌────────────────────────────────┐");
  Serial.println("│        CARD DETECTED!          │");
  Serial.println("└────────────────────────────────┘");
  
  // Beep to acknowledge card read
  playCardDetectedBeep();
  
  // Get UID
  String uid = getUID();
  Serial.print("   UID: ");
  Serial.println(uid);
  Serial.println();
  
  // Send to backend
  sendToBackend(uid);
  
  // Wait before next scan
  Serial.println();
  Serial.println("⏳ Waiting 3 seconds...");
  Serial.println();
  Serial.println("🎯 Ready for next card!");
  Serial.println("================================");
  Serial.println();
  
  delay(3000);
  
  // Halt PICC
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

// ============================================
// WIFI CONNECTION
// ============================================

void connectWiFi() {
  Serial.print("   Connecting to: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("   ✓ WiFi Connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("   ✗ WiFi Connection Failed!");
    Serial.println("   Check SSID and password");
  }
  Serial.println();
}

// ============================================
// GET UID FROM NFC CARD
// ============================================

String getUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ============================================
// SEND TO BACKEND API
// ============================================

void sendToBackend(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("   ✗ No WiFi connection!");
    return;
  }
  
  HTTPClient http;
  
  Serial.println("   📤 Sending to backend...");
  Serial.print("   URL: ");
  Serial.println(API_URL);
  
  // Start connection
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  
  // Prepare JSON payload
  String jsonPayload = "{\"uid\":\"" + uid + "\"}";
  Serial.print("   Payload: ");
  Serial.println(jsonPayload);
  Serial.println();
  
  // Send POST request
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.println("┌────────────────────────────────┐");
    Serial.println("│      ✓ RESPONSE RECEIVED       │");
    Serial.println("└────────────────────────────────┘");
    Serial.print("   HTTP Code: ");
    Serial.println(httpResponseCode);
    
    String response = http.getString();
    Serial.println("   Response:");
    Serial.println("   " + response);
    Serial.println();
    
    // Parse JSON response from backend
    if (response.indexOf("\"action\":\"check_in\"") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║            WELCOME!            ║");
      Serial.println("║       TIME IN RECORDED         ║");
      Serial.println("╚════════════════════════════════╝");
      playSuccessSound();
    } 
    else if (response.indexOf("\"action\":\"check_out\"") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║        SEE YOU LATER!          ║");
      Serial.println("║       TIME OUT RECORDED        ║");
      Serial.println("╚════════════════════════════════╝");
      playSuccessSound();
    }
    else if (response.indexOf("\"action\":\"check_out_denied\"") >= 0 || response.indexOf("\"status\":\"denied\"") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║            TOO SOON            ║");
      Serial.println("║   Wait before checking out!    ║");
      Serial.println("╚════════════════════════════════╝");
      playFailSound();
    }
    else if (response.indexOf("\"status\":\"error_unassigned\"") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║        UNREGISTERED CARD       ║");
      Serial.println("║        Card not assigned!      ║");
      Serial.println("╚════════════════════════════════╝");
      playFailSound();
    }
    else if (response.indexOf("\"status\":\"unassigned\"") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║       UNASSIGNED CARD          ║");
      Serial.println("║     Ready for assignment!      ║");
      Serial.println("╚════════════════════════════════╝");
      playAssignReadySound();
    }
    else if (response.indexOf("\"success\":false") >= 0) {
      Serial.println("╔════════════════════════════════╗");
      Serial.println("║       ✗ SERVER ERROR           ║");
      Serial.println("╚════════════════════════════════╝");
      playFailSound();
    }
    else {
      Serial.println("   ✓ Scan processed!");
      playSuccessSound();
    }
  } else {
    Serial.println("┌────────────────────────────────┐");
    Serial.println("│           ✗ ERROR              │");
    Serial.println("└────────────────────────────────┘");
    Serial.print("   HTTP Error Code: ");
    Serial.println(httpResponseCode);
    
    if (httpResponseCode == -1) {
      Serial.println("   Connection failed!");
      Serial.println("   Check:");
      Serial.println("   - Computer is on same WiFi");
      Serial.println("   - XAMPP Apache is running");
      Serial.println("   - API URL is correct");
    } else if (httpResponseCode == 404) {
      Serial.println("   API endpoint not found!");
      Serial.println("   Check API_URL in code");
    } else if (httpResponseCode == 500) {
      Serial.println("   Server error!");
      Serial.println("   Check PHP error logs");
    }
    
    playFailSound();
  }
  
  http.end();
}

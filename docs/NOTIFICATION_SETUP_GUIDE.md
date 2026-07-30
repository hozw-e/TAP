# Viber/Messenger Notification Setup Guide

Step-by-step guide to set up and test the notification system locally on XAMPP.

---

## Step 1: Run Database Migrations

The base schema is missing several columns and tables the notification system needs. Open **phpMyAdmin** (http://localhost/phpmyadmin) and run the following SQL against the `apdc_attendance` database:

```sql
-- 1. Add messenger/viber columns to guardians table
ALTER TABLE guardians
  ADD COLUMN messenger_psid VARCHAR(64) NULL AFTER guardian_cellnum,
  ADD COLUMN viber_id VARCHAR(64) NULL AFTER messenger_psid;

-- 2. Add notification tracking columns to attendance_logs
ALTER TABLE attendance_logs
  ADD COLUMN msg_channel ENUM('messenger','viber') NULL AFTER sms_sent_out,
  ADD COLUMN msg_success TINYINT(1) NULL DEFAULT NULL AFTER msg_channel,
  ADD COLUMN attendance_flag VARCHAR(20) NULL AFTER msg_success;

-- 3. Create notification_logs table (from migration file)
CREATE TABLE IF NOT EXISTS notification_logs (
  notif_id     INT          NOT NULL AUTO_INCREMENT,
  guardian_id  INT          NULL,
  student_id   INT          NULL,
  event_type   ENUM('check_in','check_out') NOT NULL,
  channel      ENUM('messenger','viber') NOT NULL,
  status       ENUM('SENT','FAILED') NOT NULL,
  error_detail VARCHAR(255) NULL,
  sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notif_id),
  KEY fk_notif_guardian (guardian_id),
  KEY fk_notif_student  (student_id),
  CONSTRAINT fk_notif_guardian FOREIGN KEY (guardian_id)
    REFERENCES guardians (guardian_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notif_student  FOREIGN KEY (student_id)
    REFERENCES students  (student_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create course_schedules table (from migration file)
CREATE TABLE IF NOT EXISTS course_schedules (
  schedule_id  INT          NOT NULL AUTO_INCREMENT,
  course_name  ENUM(
    'Basic Coding','Research','EV3','Rover 2','AI Steam',
    'Arduino','IoT','Python Programming','Robotics'
  ) NOT NULL,
  day_of_week  ENUM('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  grace_period TINYINT UNSIGNED NOT NULL DEFAULT 15,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id),
  INDEX idx_course_day (course_name, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Step 2: Set Environment Variables in Apache

Since the PHP backend uses `getenv()` and there's no dotenv library, you need to set environment variables via Apache.

Open your **Apache httpd.conf** or the **vhost config** (typically `C:\xampp\apache\conf\httpd.conf` or `C:\xampp\apache\conf\extra\httpd-vhosts.conf`) and add these lines inside your VirtualHost or at the bottom:

```apache
# Notification service environment variables
SetEnv MESSENGER_PAGE_ACCESS_TOKEN "your_facebook_page_access_token_here"
SetEnv VIBER_BOT_AUTH_TOKEN "your_viber_bot_auth_token_here"
SetEnv NOTIFICATION_CHANNEL_ORDER "messenger,viber"
```

Alternatively, you can add them to the project-level `.htaccess` at `backend/.htaccess`:

```apache
Options -Indexes
RewriteEngine On

# Notification config
SetEnv MESSENGER_PAGE_ACCESS_TOKEN "your_facebook_page_access_token_here"
SetEnv VIBER_BOT_AUTH_TOKEN "your_viber_bot_auth_token_here"
SetEnv NOTIFICATION_CHANNEL_ORDER "messenger,viber"
```

**Restart Apache** after making changes.

---

## Step 3: Get a Facebook Messenger Page Access Token

1. Go to [Meta for Developers](https://developers.facebook.com/) and create an app (type: Business)
2. Add the **Messenger** product to your app
3. Create or link a Facebook Page to the app
4. Under **Messenger > Settings > Access Tokens**, generate a Page Access Token
5. Subscribe the page to the webhook events: `messages`, `messaging_postbacks`
6. Copy the token into your `MESSENGER_PAGE_ACCESS_TOKEN` env var

**To get a test user's PSID:**
- Have someone (or yourself) send a message to your Facebook Page
- The webhook will deliver the sender's PSID in the payload
- For testing, you can use the Graph API Explorer to send a test message and grab the PSID from the response

---

## Step 4: Get a Viber Bot Auth Token

1. Go to [Viber Admin Panel](https://partners.viber.com/) and create a bot account
2. After creation, you'll receive an **Auth Token** — copy this into `VIBER_BOT_AUTH_TOKEN`
3. Set the webhook URL for your bot (needs a public URL — use ngrok for local testing):
   ```
   POST https://chatapi.viber.com/pa/set_webhook
   Headers: X-Viber-Auth-Token: <your_token>
   Body: { "url": "https://your-ngrok-url.ngrok.io/apdc/backend/api/viber-webhook.php" }
   ```

**To get a test user's Viber ID:**
- Have the test user open a conversation with your Viber bot
- The webhook delivers a `subscribed` event with the user's Viber ID
- For testing, you can also manually copy the ID from the Viber webhook payload

---

## Step 5: Link a Guardian to Messenger/Viber

In the admin panel, edit a guardian and fill in one or both of:
- **Messenger PSID** — the page-scoped user ID from Step 3
- **Viber ID** — the user ID from Step 4

Or directly via SQL for quick testing:

```sql
UPDATE guardians
SET messenger_psid = 'TEST_PSID_HERE',
    viber_id = 'TEST_VIBER_ID_HERE'
WHERE guardian_id = 1;
```

---

## Step 6: Test with a Simulated NFC Scan

You don't need the ESP32 hardware to test. Just POST to the scan endpoint:

```bash
curl -X POST http://localhost/apdc/backend/api/nfc/scan.php ^
  -H "Content-Type: application/json" ^
  -d "{\"uid\": \"YOUR_NFC_UID_HERE\"}"
```

Replace `YOUR_NFC_UID_HERE` with an actual UID from your `nfc_tags` table. Check with:

```sql
SELECT uid, student_id FROM nfc_tags;
```

Make sure that student has a linked guardian (`guardian_id` is set in the `students` table) and that guardian has `messenger_psid` or `viber_id` populated.

---

## Step 7: Verify Results

After the scan:

1. **Check the API response** — should include `"notification_sent": true` if it worked

2. **Check notification_logs table:**
   ```sql
   SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 10;
   ```
   You should see a row with `status = 'SENT'` and the channel used.

3. **Check attendance_logs:**
   ```sql
   SELECT attendance_id, student_id, msg_channel, msg_success
   FROM attendance_logs ORDER BY attendance_id DESC LIMIT 5;
   ```

4. **Check PHP error log** — The NotificationService logs every attempt:
   - `C:\xampp\apache\logs\error.log` or
   - `C:\xampp\php\logs\php_error_log`
   
   Look for lines starting with `NotificationService::`.

5. **Check the frontend** — Go to the Attendance Logs page. The "Notification" column should show "Messenger" or "Viber" for the new record.

---

## Quick Test Without Real APIs (Dry Run)

If you just want to verify the code flow works without actual Messenger/Viber API keys:

1. Leave the tokens as dummy values (e.g., `"test_token"`)
2. Run the curl command from Step 6
3. The API calls will fail (HTTP errors), but the system will:
   - Log attempts to `notification_logs` with `status = 'FAILED'`
   - Set `msg_success = 0` in `attendance_logs`
   - Show "FAILED" in the frontend notification column

This confirms the wiring is correct. Replace with real tokens when ready for actual delivery.

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| `getenv()` returns empty | Restart Apache after setting env vars. Verify with `<?php phpinfo(); ?>` |
| "Guardian not found" in logs | Make sure the student's `guardian_id` points to a valid guardian |
| "No contact method available" | Guardian has neither `messenger_psid` nor `viber_id` set |
| Messenger returns 400 | Token expired or PSID is invalid — regenerate token in Meta dashboard |
| Viber returns status != 0 | Auth token wrong or user hasn't subscribed to the bot |
| Columns don't exist errors | Migration in Step 1 wasn't run — run the ALTER TABLE statements |

---

## Optional: Use ngrok for Webhooks

For Messenger and Viber to send you user IDs via webhooks during local development:

```bash
ngrok http 80
```

Then use the `https://xxxx.ngrok.io` URL as your webhook base. This lets you:
- Receive Messenger webhook events (to capture PSIDs)
- Receive Viber subscription events (to capture Viber IDs)

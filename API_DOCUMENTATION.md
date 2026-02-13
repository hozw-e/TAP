# SMART ATTENDANCE SYSTEM - API DOCUMENTATION

## Setup Instructions

### 1. Install XAMPP
- Download XAMPP from https://www.apachefriends.org/
- Install and start Apache and MySQL services

### 2. Setup Database
- Open phpMyAdmin (http://localhost/phpmyadmin)
- Create a new database called `attendance_db`
- Run your SQL schema to create all tables

### 3. Configure Database Connection
- Edit `/config/database.php`
- Update `DB_NAME` to match your database name (default: attendance_db)
- Update `DB_USER` and `DB_PASS` if you changed MySQL credentials

### 4. Copy Project to XAMPP
- Copy the entire `attendance-system` folder to `C:\xampp\htdocs\`
- Your project should be at: `C:\xampp\htdocs\attendance-system\`

### 5. Create Test Admin
Run this SQL in phpMyAdmin:
```sql
INSERT INTO admins (admin_name, username, password) 
VALUES ('Admin User', 'admin', 'admin123');
```

### 6. Test the API
- Open your browser or Postman
- Try the test endpoint: http://localhost/attendance-system/api/auth/check-session.php

---

## API Endpoints

### Authentication

#### 1. Admin Login
**POST** `/api/auth/login.php`

Request:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin_id": 1,
    "admin_name": "Admin User",
    "username": "admin"
  }
}
```

#### 2. Admin Logout
**POST** `/api/auth/logout.php`

Response:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### 3. Check Session
**GET** `/api/auth/check-session.php`

Response (Logged In):
```json
{
  "success": true,
  "message": "Admin is logged in",
  "data": {
    "logged_in": true,
    "admin_id": 1,
    "admin_username": "admin"
  }
}
```

---

### Guardians

#### 1. Create Guardian
**POST** `/api/guardians/create.php`
**Requires:** Admin Login

Request:
```json
{
  "guardian_name": "John Doe",
  "guardian_cellnum": "+639123456789"
}
```

#### 2. List Guardians
**GET** `/api/guardians/list.php`
**Requires:** Admin Login

---

### Students

#### 1. Create Student
**POST** `/api/students/create.php`
**Requires:** Admin Login

Request:
```json
{
  "guardian_id": 1,
  "student_name": "Jane Doe",
  "address": "123 Main Street",
  "student_cellnum": "+639987654321"
}
```

#### 2. List Students
**GET** `/api/students/list.php`
**Requires:** Admin Login

Response includes guardian info and NFC UID if assigned.

---

### NFC Tags

#### 1. Assign NFC Tag
**POST** `/api/nfc/assign.php`
**Requires:** Admin Login

Request:
```json
{
  "student_id": 1,
  "uid": "A1B2C3D4"
}
```

#### 2. NFC Scan (Main Attendance Logging)
**POST** `/api/nfc/scan.php`
**Requires:** Admin must be logged in (active session)
**Called by:** ESP32/Arduino device

Request:
```json
{
  "uid": "A1B2C3D4"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "Attendance logged: TIME IN",
  "data": {
    "student_id": 1,
    "student_name": "Jane Doe",
    "action": "TIME IN",
    "time": "08:30:45",
    "date": "2026-02-13",
    "sms_sent": true,
    "display_message": "Jane Doe\nTIME IN\n08:30:45"
  }
}
```

Response (No Admin Session):
```json
{
  "success": false,
  "message": "Cannot log attendance: No admin session active. Admin must be logged in."
}
```

**IMPORTANT NOTES:**
- Admin MUST be logged in for attendance to be logged
- First scan of the day = TIME IN
- Second scan = TIME OUT
- Third scan = Rejected (already completed for the day)
- SMS is sent to guardian's phone number
- `display_message` can be shown on LCD/LED screen

---

### Attendance Logs

#### 1. List Attendance
**GET** `/api/attendance/list.php`
**Requires:** Admin Login

Query Parameters:
- `date` - Filter by date (YYYY-MM-DD)
- `student_id` - Filter by student ID

Examples:
- Get all attendance: `/api/attendance/list.php`
- Get today's attendance: `/api/attendance/list.php?date=2026-02-13`
- Get student's attendance: `/api/attendance/list.php?student_id=1`

#### 2. Recent Attendance (Real-time)
**GET** `/api/attendance/recent.php`
**Requires:** Admin Login

Query Parameters:
- `since` - Unix timestamp (optional)

Returns attendance from last 5 minutes or since the provided timestamp.
Use this for polling to show real-time updates in the dashboard.

Example:
```
/api/attendance/recent.php?since=1707782400
```

---

## Testing with Postman

### Step 1: Login
1. Create POST request to: `http://localhost/attendance-system/api/auth/login.php`
2. Set Headers: `Content-Type: application/json`
3. Set Body (raw JSON):
```json
{
  "username": "admin",
  "password": "admin123"
}
```
4. Send request - you should get admin info back

### Step 2: Create Guardian
1. Create POST request to: `http://localhost/attendance-system/api/guardians/create.php`
2. Set Headers: `Content-Type: application/json`
3. Set Body:
```json
{
  "guardian_name": "Maria Santos",
  "guardian_cellnum": "+639123456789"
}
```
4. Send request - note the `guardian_id` returned

### Step 3: Create Student
1. Create POST request to: `http://localhost/attendance-system/api/students/create.php`
2. Use the `guardian_id` from Step 2
3. Set Body:
```json
{
  "guardian_id": 1,
  "student_name": "Juan Santos",
  "address": "123 Test Street",
  "student_cellnum": "+639987654321"
}
```

### Step 4: Assign NFC Tag
1. Create POST request to: `http://localhost/attendance-system/api/nfc/assign.php`
2. Use the `student_id` from Step 3
3. Set Body:
```json
{
  "student_id": 1,
  "uid": "TEST1234"
}
```

### Step 5: Test NFC Scan (Simulate Arduino/ESP32)
1. Create POST request to: `http://localhost/attendance-system/api/nfc/scan.php`
2. Set Body:
```json
{
  "uid": "TEST1234"
}
```
3. First scan = TIME IN
4. Send again = TIME OUT
5. Send third time = Rejected

### Step 6: View Attendance
1. Create GET request to: `http://localhost/attendance-system/api/attendance/list.php`
2. View all logged attendance

---

## System Workflow

```
1. Admin opens browser -> Login Page
   ↓
2. Admin enters credentials -> Click Login
   ↓
3. POST /api/auth/login.php -> Session created
   ↓
4. Redirect to Dashboard
   ↓
5. Dashboard starts polling /api/attendance/recent.php every 3 seconds
   ↓
6. [Student scans NFC card]
   ↓
7. ESP32/Arduino -> POST /api/nfc/scan.php with UID
   ↓
8. scan.php checks: Is admin logged in?
   ├─ YES: Log attendance, send SMS, return success
   └─ NO: Return error
   ↓
9. Dashboard polling detects new log -> Show popup notification
   ↓
10. ESP32 receives response -> Display on LED + Buzzer sound
```

---

## Important Security Notes

⚠️ **FOR PRODUCTION, YOU MUST:**

1. **Hash Passwords:** 
   - Currently using plain text passwords (for prototype only!)
   - Change to `password_hash()` and `password_verify()` before deployment

2. **HTTPS:**
   - Use HTTPS in production
   - ESP32 will need to connect via HTTPS

3. **Rate Limiting:**
   - Add rate limiting to prevent abuse
   - Especially on scan endpoint

4. **Input Sanitization:**
   - Currently basic validation
   - Add more thorough sanitization for production

---

## Next Steps

1. ✅ Test all endpoints with Postman
2. ⏭️ Build frontend admin pages (login, dashboard)
3. ⏭️ Add Twilio SMS integration
4. ⏭️ Program ESP32/Arduino to send NFC scans
5. ⏭️ Add real-time notifications to dashboard

---

## Troubleshooting

**Error: "Database connection failed"**
- Check XAMPP MySQL is running
- Verify database name in config/database.php
- Check MySQL username/password

**Error: "No admin session active"**
- Admin must be logged in first
- Check session is working with /api/auth/check-session.php

**Error: "Method not allowed"**
- Using wrong HTTP method (GET vs POST)
- Check endpoint documentation above

**Error: "NFC tag not recognized"**
- Tag hasn't been assigned to a student yet
- Use /api/nfc/assign.php first

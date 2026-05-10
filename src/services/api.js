import axios from 'axios';

// Base URL for your PHP backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for sessions/cookies
});

// ============================================
// AUTHENTICATION API
// ============================================

export const authAPI = {
  // Login admin
  login: async (username, password) => {
    const response = await api.post('/auth/login.php', { username, password });
    return response.data;
  },

  // Logout admin
  logout: async () => {
    const response = await api.post('/auth/logout.php');
    return response.data;
  },

  // Check if admin is logged in
  checkSession: async () => {
    const response = await api.get('/auth/check-session.php');
    return response.data;
  },
};

// ============================================
// STUDENTS API
// ============================================

export const studentsAPI = {
  // Get all students (with optional archive filter)
  list: async (archived = false) => {
    const params = archived ? '?archived=1' : '';
    const response = await api.get(`/students/list.php${params}`);
    return response.data;
  },
 
  // Create new student
  create: async (studentData) => {
    const response = await api.post('/students/create.php', studentData);
    return response.data;
  },
 
  // Update student
  update: async (studentId, studentData) => {
    const response = await api.post(`/students/update.php?id=${studentId}`, studentData);
    return response.data;
  },
 
  // Delete student (only archived students can be deleted)
  delete: async (studentId) => {
    const response = await api.post(`/students/delete.php?id=${studentId}`, {});
    return response.data;
  },
  
  // Archive student
  archive: async (studentId) => {
    const response = await api.post(`/students/archive.php?id=${studentId}`, {});
    return response.data;
  },
  
  // Unarchive student
  unarchive: async (studentId) => {
    const response = await api.post(`/students/unarchive.php?id=${studentId}`, {});
    return response.data;
  },
};


// ============================================
// GUARDIANS API
// ============================================

export const guardiansAPI = {
  // Get all guardians
  list: async () => {
    const response = await api.get('/guardians/list.php');
    return response.data;
  },
 
  // Create new guardian
  create: async (guardianData) => {
    const response = await api.post('/guardians/create.php', guardianData);
    return response.data;
  },
 
  // Update guardian
  update: async (guardianId, guardianData) => {
    const response = await api.post(`/guardians/update.php?id=${guardianId}`, guardianData);
    return response.data;
  },
};


// ============================================
// NFC API
// ============================================

export const nfcAPI = {
  // Assign NFC tag to student
  // Called by EditRecordModal after a scan is detected
  assign: async ({ student_id, uid }) => {
    const response = await api.post('/nfc/assign.php', { student_id, uid });
    return response.data;
  },

  // Poll for the latest unconsumed scan from temp_nfc_scans
  // Called by useNFCScanner every 500ms while scanning is active
  getLastScan: async () => {
    const response = await api.get('/nfc/get-last-scan.php');
    return response.data;
  },

  // Mark all unconsumed scans as consumed after frontend reads them
  // Called by useNFCScanner immediately after a UID is picked up
  clearScan: async () => {
    const response = await api.post('/nfc/clear-scan.php');
    return response.data;
  },

  // Handle NFC scan (from ESP32 hardware)
  scan: async (uid) => {
    const response = await api.post('/nfc/scan.php', { uid });
    return response.data;
  },
};

// ============================================
// VISITORS API
// ============================================

export const visitorsAPI = {
  // Check in a visitor by name
  checkin: async (name) => {
    const response = await api.post('/visitors/checkin.php', { name });
    return response.data;
  },
};

// ============================================
// ATTENDANCE API
// ============================================

export const attendanceAPI = {
  // Get attendance logs (with optional filters)
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/attendance/list.php?${params}`);
    return response.data;
  },

  // Get recent attendance (for real-time updates)
  recent: async (since) => {
    const params = since ? `?since=${since}` : '';
    const response = await api.get(`/attendance/recent.php${params}`);
    return response.data;
  },
};

// ============================================
// ERROR HANDLING
// ============================================

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data);
      
      // If unauthorized (401), redirect to login
      if (error.response.status === 401) {
        window.location.href = '/';
      }
    } else if (error.request) {
      // Request was made but no response
      console.error('Network Error:', error.request);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  // Get dashboard stats
  getStats: async () => {
    try {
      const response = await api.get('/dashboard/stats.php');
      return response.data;
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return { success: false, data: { totalStudents: 0, presentToday: 0, enrolledToday: 0 } };
    }
  },
 
  // Get attendance logs for a specific date
  getAttendanceLogs: async (date) => {
    try {
      const response = await api.get(`/dashboard/logs.php?date=${date}`);
      return response.data;
    } catch (error) {
      console.error('Attendance logs error:', error);
      return { success: false, data: [] };
    }
  },
};

// ============================================
// ACTIVITY LOGS API
// ============================================

export const activityLogsAPI = {
  // Get activity logs with filters
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/activity-logs/list.php?${params}`);
    return response.data;
  },

  // Export activity logs as CSV
  export: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    window.location.href = `${API_BASE_URL}/activity-logs/export.php?${params}`;
  },
};

export default api;
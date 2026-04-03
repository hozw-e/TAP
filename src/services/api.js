import axios from 'axios';

// Base URL for your PHP backend
const API_BASE_URL = 'http://localhost/apdc/backend/api';

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
  // Get all students
  list: async () => {
    const response = await api.get('/students/list.php');
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
 
  // Delete student
  delete: async (studentId) => {
    const response = await api.post(`/students/delete.php?id=${studentId}`, {});
    return response.data;
  },
};

/* export const studentsAPI = {
  // Get all students
  list: async () => {
    const response = await api.get('/students/list.php');
    return response.data;
  },

  // Create new student
  create: async (studentData) => {
    const response = await api.post('/students/create.php', studentData);
    return response.data;
  },

  // Update student
  update: async (studentId, studentData) => {
    const response = await api.put(`/students/update.php?id=${studentId}`, studentData);
    return response.data;
  },

  // Delete student
  delete: async (studentId) => {
    const response = await api.delete(`/students/delete.php?id=${studentId}`);
    return response.data;
  },
}; */

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

/* export const guardiansAPI = {
  list: async () => {
    const response = await api.get('/guardians/list.php');
    return response.data;
  },

  create: async (guardianData) => {
    const response = await api.post('/guardians/create.php', guardianData);
    return response.data;
  },

  // Update guardian
  update: async (guardianId, guardianData) => {
    const response = await api.put(`/guardians/update.php?id=${guardianId}`, guardianData);
    return response.data;
  },
}; */

// ============================================
// NFC API
// ============================================

export const nfcAPI = {
  // Assign NFC tag to student
  assign: async (studentId, uid) => {
    const response = await api.post('/nfc/assign.php', { student_id: studentId, uid });
    return response.data;
  },

  // Handle NFC scan (from hardware)
  scan: async (uid) => {
    const response = await api.post('/nfc/scan.php', { uid });
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

export default api;

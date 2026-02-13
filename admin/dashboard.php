<?php
session_start();

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: index.php');
    exit();
}

$adminName = $_SESSION['admin_name'] ?? 'Admin';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - A+ Solutions</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 130px;
            background: #2c3e50;
            color: white;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .logo-circle {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            padding: 0;
            margin-bottom: 40px;
        }

        .logo-circle img {
            width: 100%;
            height: 100%;
            object-fit: cover;  /* Changed from 'contain' to 'cover' */
        }

        .nav-icon {
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 10px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            color: white;
            font-size: 24px;
        }

        .nav-icon:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .nav-icon.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        /* Main Content */
        .main-content {
            margin-left: 130px;
            flex: 1;
            padding: 30px;
        }

        .page-header {
            margin-bottom: 30px;
        }

        .page-header h1 {
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 5px;
        }

        .page-header p {
            color: #7f8c8d;
            font-size: 14px;
        }

        /* Stats Cards */
        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
        }

        .stat-card-header {
            background: #34495e;
            color: white;
            padding: 15px 20px;
            font-weight: 600;
            font-size: 16px;
        }

        .stat-card-body {
            padding: 30px 20px;
            text-align: center;
        }

        .stat-number {
            font-size: 48px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .stat-label {
            color: #7f8c8d;
            font-size: 14px;
        }

        /* Attendance Logs Section */
        .logs-section {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .logs-header {
            background: #34495e;
            color: white;
            padding: 15px 20px;
            font-weight: 600;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logs-body {
            padding: 20px;
            max-height: 500px;
            overflow-y: auto;
        }

        /* Table */
        .logs-table {
            width: 100%;
            border-collapse: collapse;
        }

        .logs-table thead {
            background: #ecf0f1;
            position: sticky;
            top: 0;
        }

        .logs-table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #2c3e50;
            font-size: 14px;
        }

        .logs-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            color: #34495e;
            font-size: 14px;
        }

        .logs-table tbody tr:hover {
            background: #f8f9fa;
        }

        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
        }

        .status-in {
            background: #d4edda;
            color: #155724;
        }

        .status-out {
            background: #f8d7da;
            color: #721c24;
        }

        /* Notification Popup */
        .notification-popup {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
            min-width: 320px;
            max-width: 400px;
            transform: translateY(150px);
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 1000;
            overflow: hidden;
        }

        .notification-popup.show {
            transform: translateY(0);
            opacity: 1;
        }

        .notification-header {
            background: #e67e22;
            color: white;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .notification-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }

        .notification-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
            transition: opacity 0.2s;
        }

        .notification-close:hover {
            opacity: 1;
        }

        .notification-body {
            padding: 20px;
            color: #2c3e50;
            font-size: 14px;
            line-height: 1.6;
        }

        .notification-body strong {
            color: #2c3e50;
            font-weight: 600;
        }

        /* Loading */
        .loading-spinner {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
        }

        .spinner {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid #ecf0f1;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
        }

        .empty-state i {
            font-size: 48px;
            margin-bottom: 15px;
            opacity: 0.3;
        }

        /* Logout Button */
        .logout-btn {
            margin-top: auto;
            padding: 12px 20px;
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            width: 90%;
        }

        .logout-btn:hover {
            background: #e74c3c;
            color: white;
        }

        /* Filter Controls */
        .filter-controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .filter-controls input,
        .filter-controls select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }

        .refresh-btn {
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }

        .refresh-btn:hover {
            background: #5568d3;
        }

        /* Logout Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        .modal-overlay.show {
            display: flex;
        }

        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        .modal-icon {
            width: 60px;
            height: 60px;
            background: #fee;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 20px;
            color: #e74c3c;
            font-size: 24px;
        }

        .modal-title {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .modal-message {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 25px;
        }

        .modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .modal-btn {
            padding: 12px 30px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .modal-btn-cancel {
            background: #ecf0f1;
            color: #2c3e50;
        }

        .modal-btn-cancel:hover {
            background: #d5dbdb;
        }

        .modal-btn-confirm {
            background: #e74c3c;
            color: white;
        }

        .modal-btn-confirm:hover {
            background: #c0392b;
        }
    </style>
</head>
<body>
    <!-- Sidebar -->
    <div class="sidebar">
        <div class="logo-circle">
            <img src="logo.png" alt="A+ Solutions" onerror="this.style.display='none'">
        </div>
        
        <div class="nav-icon active" title="Dashboard">
            <i class="fas fa-th-large"></i>
        </div>
        
        <div class="nav-icon" title="Students" onclick="window.location.href='students.php'">
            <i class="fas fa-users"></i>
        </div>
        
        <button class="logout-btn" onclick="showLogoutModal()">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <div class="page-header">
            <h1>Dashboard</h1>
            <p>Welcome back, <?php echo htmlspecialchars($adminName); ?>!</p>
        </div>

        <!-- Stats Cards -->
        <div class="stats-container">
            <div class="stat-card">
                <div class="stat-card-header">Enrollees</div>
                <div class="stat-card-body">
                    <div class="stat-number" id="totalEnrollees">-</div>
                    <div class="stat-label">Total Students</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">Present</div>
                <div class="stat-card-body">
                    <div class="stat-number" id="presentCount">-</div>
                    <div class="stat-label">Currently In Facility</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">Newcomers</div>
                <div class="stat-card-body">
                    <div class="stat-number" id="newcomersCount">-</div>
                    <div class="stat-label">Enrolled Today</div>
                </div>
            </div>
        </div>

        <!-- Attendance Logs -->
        <div class="logs-section">
            <div class="logs-header">
                <span>Attendance Logs</span>
                <div class="filter-controls">
                    <input type="date" id="filterDate" value="<?php echo date('Y-m-d'); ?>">
                    <button class="refresh-btn" onclick="loadAttendanceLogs()">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
            </div>
            <div class="logs-body" id="logsContainer">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading attendance logs...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Notification Popup -->
    <div class="notification-popup" id="notificationPopup">
        <div class="notification-header">
            <div class="notification-header-left">
                <i class="fas fa-bell"></i>
                <span>Notification</span>
            </div>
            <button class="notification-close" onclick="closeNotification()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-body" id="notificationBody">
            <strong>Student Name</strong> has entered the facility.
        </div>
    </div>

    <!-- Logout Modal -->
    <div class="modal-overlay" id="logoutModal">
        <div class="modal-content">
            <div class="modal-icon">
                <i class="fas fa-sign-out-alt"></i>
            </div>
            <div class="modal-title">Confirm Logout</div>
            <div class="modal-message">Are you sure you want to log out?</div>
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-cancel" onclick="hideLogoutModal()">Cancel</button>
                <button class="modal-btn modal-btn-confirm" onclick="confirmLogout()">Log Out</button>
            </div>
        </div>
    </div>

    <script>
        let lastCheckTimestamp = Math.floor(Date.now() / 1000);
        let pollingInterval;

        // Load initial data
        window.onload = function() {
            loadStatistics();
            loadAttendanceLogs();
            startPolling();
        };

        // Load statistics
        async function loadStatistics() {
            try {
                // Get total enrollees
                const studentsResponse = await fetch('http://localhost/apdc/api/students/list.php');
                const studentsData = await studentsResponse.json();
                
                if (studentsData.success) {
                    document.getElementById('totalEnrollees').textContent = studentsData.data.length;
                    
                    // Count newcomers (enrolled today)
                    const today = new Date().toISOString().split('T')[0];
                    const newcomers = studentsData.data.filter(student => {
                        // Assuming you add a created_at field to students table
                        return student.created_at && student.created_at.startsWith(today);
                    });
                    document.getElementById('newcomersCount').textContent = newcomers.length;
                }

                // Get present count (students currently in facility)
                const attendanceResponse = await fetch('http://localhost/apdc/api/attendance/list.php?date=' + new Date().toISOString().split('T')[0]);
                const attendanceData = await attendanceResponse.json();
                
                if (attendanceData.success) {
                    const present = attendanceData.data.filter(log => log.time_in && !log.time_out);
                    document.getElementById('presentCount').textContent = present.length;
                }
                
            } catch (error) {
                console.error('Error loading statistics:', error);
            }
        }

        // Load attendance logs
        async function loadAttendanceLogs() {
            const filterDate = document.getElementById('filterDate').value;
            const container = document.getElementById('logsContainer');
            
            try {
                const response = await fetch(`http://localhost/apdc/api/attendance/list.php?date=${filterDate}`);
                const data = await response.json();
                
                if (data.success && data.data.length > 0) {
                    let tableHTML = `
                        <table class="logs-table">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Time In</th>
                                    <th>Time Out</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    data.data.forEach(log => {
                        const status = log.time_out ? 'OUT' : 'IN';
                        const statusClass = log.time_out ? 'status-out' : 'status-in';
                        
                        tableHTML += `
                            <tr>
                                <td>${log.student_name}</td>
                                <td>${log.time_in || '-'}</td>
                                <td>${log.time_out || '-'}</td>
                                <td><span class="status-badge ${statusClass}">${status}</span></td>
                            </tr>
                        `;
                    });
                    
                    tableHTML += `
                            </tbody>
                        </table>
                    `;
                    
                    container.innerHTML = tableHTML;
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-clipboard-list"></i>
                            <p>No attendance logs for this date</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading logs:', error);
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading attendance logs</p>
                    </div>
                `;
            }
        }

        // Start polling for new attendance
        function startPolling() {
            pollingInterval = setInterval(checkNewAttendance, 3000); // Check every 3 seconds
        }

        // Check for new attendance
        async function checkNewAttendance() {
            try {
                const response = await fetch(`http://localhost/apdc/api/attendance/recent.php?since=${lastCheckTimestamp}`);
                const data = await response.json();
                
                if (data.success && data.data.logs && data.data.logs.length > 0) {
                    // Show notification for the most recent log
                    const latestLog = data.data.logs[0];
                    showNotification(latestLog);
                    
                    // Update timestamp
                    lastCheckTimestamp = data.data.timestamp;
                    
                    // Refresh logs and statistics
                    loadAttendanceLogs();
                    loadStatistics();
                }
            } catch (error) {
                console.error('Error checking new attendance:', error);
            }
        }

        // Show notification popup
        function showNotification(log) {
            const popup = document.getElementById('notificationPopup');
            const body = document.getElementById('notificationBody');
            
            const message = log.action === 'TIME IN' 
                ? 'has entered the facility.' 
                : 'has left the facility.';
            
            body.innerHTML = `<strong>${log.student_name}</strong> ${message}`;
            
            popup.classList.add('show');
            
            // Play sound (optional)
            playNotificationSound();
            
            // Hide after 5 seconds
            setTimeout(() => {
                popup.classList.remove('show');
            }, 5000);
        }

        // Close notification manually
        function closeNotification() {
            document.getElementById('notificationPopup').classList.remove('show');
        }

        // Play notification sound
        function playNotificationSound() {
            // Create audio element and play notification sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=');
            audio.play().catch(e => console.log('Could not play sound'));
        }

        // Show logout modal
        function showLogoutModal() {
            document.getElementById('logoutModal').classList.add('show');
        }

        // Hide logout modal
        function hideLogoutModal() {
            document.getElementById('logoutModal').classList.remove('show');
        }

        // Confirm logout
        async function confirmLogout() {
            try {
                await fetch('http://localhost/apdc/api/auth/logout.php', {
                    method: 'POST'
                });
                window.location.href = 'index.php';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'index.php';
            }
        }

        // Update logs when date filter changes
        document.getElementById('filterDate').addEventListener('change', loadAttendanceLogs);

        // Stop polling when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(pollingInterval);
            } else {
                startPolling();
            }
        });
    </script>
</body>
</html>

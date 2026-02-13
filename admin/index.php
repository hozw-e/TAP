<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - A+ Solutions</title>
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .login-container {
            background: #2c3e50;
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            position: relative;
        }

        .logo-container {
            position: absolute;
            top: -90px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
            overflow: hidden;  
        }

        .logo-container img {
            width: 100%;
            height: 100%;
            object-fit: contain; 
        }

        .login-header {
            text-align: center;
            margin-top: 40px;
            margin-bottom: 30px;
        }

        .login-header h2 {
            color: white;
            font-size: 24px;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 20px;
            position: relative;
        }

        .form-group input {
            width: 100%;
            padding: 15px 45px 15px 15px;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            background: white;
            color: #333;
            outline: none;
            transition: all 0.3s ease;
        }

        .form-group input:focus {
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
        }

        .form-group input::placeholder {
            color: #999;
        }

        .icon-container {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            cursor: pointer;
            font-size: 16px;
        }

        .toggle-password {
            cursor: pointer;
            user-select: none;
        }

        .login-button {
            width: 50%;
            max-width: 250px;
            margin: 10px auto 0;
            display: block;
            padding: 15px;
            background: #3498db;
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .login-button:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(52, 152, 219, 0.4);
        }

        .login-button:active {
            transform: translateY(0);
        }

        .login-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .error-message {
            background: #e74c3c;
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            display: none;
            animation: slideDown 0.3s ease;
        }

        .error-message.show {
            display: block;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Font Awesome Icons */
        .user-icon::before {
            font-family: "Font Awesome 6 Free";
            font-weight: 400;
            content: "\f007";
        }

        .eye-icon::before {
            font-family: "Font Awesome 6 Free";
            font-weight: 400;
            content: "\f06e";
        }

        .eye-icon.hide::before {
            font-family: "Font Awesome 6 Free";
            font-weight: 400;
            content: "\f070";
        }
    </style>
</head>
<body>
    <div class="login-container">
        <!-- Logo placeholder - replace with actual logo -->
        <div class="logo-container">
            <img src="logo.png" alt="A+ Solutions Logo" id="logo" onerror="this.style.display='none'">
        </div>

        <div class="login-header">
            <h2>Admin Panel</h2>
        </div>

        <div id="errorMessage" class="error-message"></div>

        <form id="loginForm">
            <div class="form-group">
                <input 
                    type="text" 
                    id="username" 
                    name="username" 
                    placeholder="Username" 
                    required
                    autocomplete="username"
                >
                <div class="icon-container">
                    <span class="user-icon"></span>
                </div>
            </div>

            <div class="form-group">
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    placeholder="Password" 
                    required
                    autocomplete="current-password"
                >
                <div class="icon-container toggle-password" onclick="togglePassword()">
                    <span class="eye-icon" id="eyeIcon"></span>
                </div>
            </div>

            <button type="submit" class="login-button" id="loginBtn">
                Log in
            </button>
        </form>
    </div>

    <script>
        // Toggle password visibility
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const eyeIcon = document.getElementById('eyeIcon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.classList.add('hide');
            } else {
                passwordInput.type = 'password';
                eyeIcon.classList.remove('hide');
            }
        }

        // Show error message
        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
            
            setTimeout(() => {
                errorDiv.classList.remove('show');
            }, 5000);
        }

        // Handle form submission
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            
            // Validation
            if (!username || !password) {
                showError('Please enter both username and password');
                return;
            }
            
            // Disable button and show loading
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="loading"></span> Logging in...';
            
            try {
                const response = await fetch('http://localhost/apdc/api/auth/login.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Login successful - redirect to dashboard
                    window.location.href = 'dashboard.php';
                } else {
                    // Show error
                    showError(data.message || 'Invalid username or password');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Log in';
                }
                
            } catch (error) {
                console.error('Login error:', error);
                showError('Connection error. Please check your server.');
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Log in';
            }
        });

        // Clear error on input
        document.getElementById('username').addEventListener('input', () => {
            document.getElementById('errorMessage').classList.remove('show');
        });
        
        document.getElementById('password').addEventListener('input', () => {
            document.getElementById('errorMessage').classList.remove('show');
        });
    </script>
</body>
</html>

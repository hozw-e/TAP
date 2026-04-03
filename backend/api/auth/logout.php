<?php
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
 
// Start session
session_start();
 
// Clear session
session_unset();
session_destroy();
 
sendSuccessResponse('Logged out successfully');
?>
 
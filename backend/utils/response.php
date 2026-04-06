<?php
/**
 * JSON Response Helper
 * Standardizes API responses
 */

/**
 * Send success response
 */
function sendSuccessResponse($message, $data = null) {
    $response = [
        'success' => true,
        'message' => $message
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    http_response_code(200);
    echo json_encode($response);
    exit();
}
 
/**
 * Send error response
 */
function sendErrorResponse($message, $statusCode = 400) {
    $response = [
        'success' => false,
        'message' => $message
    ];
    
    http_response_code($statusCode);
    echo json_encode($response);
    exit();
}
 
/**
 * Send validation error response
 */
function sendValidationError($errors) {
    $response = [
        'success' => false,
        'message' => 'Validation failed',
        'errors' => $errors
    ];
    
    http_response_code(422);
    echo json_encode($response);
    exit();
}

/**
 * Validate required fields in request data
 * @param array $data Request data
 * @param array $requiredFields List of required field names
 * @return array|null Returns null if valid, array of missing fields if invalid
 */

function validateRequiredFields($data, $requiredFields) {
    $missingFields = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            $missingFields[] = $field;
        }
    }
    
    return empty($missingFields) ? null : $missingFields;
}

/* -------------------------------- old code ---------------------------------- */
/**
 * Send success response
 * @param mixed $data Data to return
 * @param string $message Success message
 * @param int $code HTTP status code
 */
/* function sendSuccess($data = null, $message = 'Success', $code = 200) {
    http_response_code($code);
    $response = [
        'success' => true,
        'message' => $message
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    echo json_encode($response);
    exit();
} */

/**
 * Send error response
 * @param string $message Error message
 * @param int $code HTTP status code
 * @param mixed $errors Additional error details
 */
/* function sendError($message = 'An error occurred', $code = 400, $errors = null) {
    http_response_code($code);
    $response = [
        'success' => false,
        'message' => $message
    ];
    
    if ($errors !== null) {
        $response['errors'] = $errors;
    }
    
    echo json_encode($response);
    exit();
} */

?>

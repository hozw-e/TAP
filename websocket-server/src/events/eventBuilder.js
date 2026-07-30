const logger = require('../utils/logger');

/**
 * Valid action types for attendance events.
 */
const VALID_ACTIONS = ['check_in', 'check_out'];

/**
 * Valid attendance flag values (null is also allowed).
 */
const VALID_FLAGS = ['present', 'tardy'];

/**
 * Maximum allowed length for student_name.
 */
const MAX_NAME_LENGTH = 100;

/**
 * ISO 8601 date-time regex (basic validation).
 * Accepts formats like: 2024-01-15T09:30:00Z, 2024-01-15T09:30:00+08:00, 2024-01-15T09:30:00.000Z
 */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Validates an incoming attendance event payload from the PHP backend.
 *
 * Required fields:
 *   - student_id (number, positive integer)
 *   - student_name (string, max 100 chars)
 *   - action ("check_in" | "check_out")
 *   - timestamp (ISO 8601 string)
 *
 * Optional fields:
 *   - course (string | null)
 *   - attendance_flag ("present" | "tardy" | null)
 *
 * @param {object} payload - The raw request body
 * @returns {{ valid: true, event: object } | { valid: false, error: string }}
 */
function validateEvent(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  // Validate student_id
  if (payload.student_id === undefined || payload.student_id === null) {
    return { valid: false, error: 'Missing required field: student_id' };
  }
  if (typeof payload.student_id !== 'number' || !Number.isInteger(payload.student_id) || payload.student_id <= 0) {
    return { valid: false, error: 'student_id must be a positive integer' };
  }

  // Validate student_name
  if (payload.student_name === undefined || payload.student_name === null) {
    return { valid: false, error: 'Missing required field: student_name' };
  }
  if (typeof payload.student_name !== 'string' || payload.student_name.trim().length === 0) {
    return { valid: false, error: 'student_name must be a non-empty string' };
  }
  if (payload.student_name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `student_name must not exceed ${MAX_NAME_LENGTH} characters` };
  }

  // Validate action
  if (payload.action === undefined || payload.action === null) {
    return { valid: false, error: 'Missing required field: action' };
  }
  if (!VALID_ACTIONS.includes(payload.action)) {
    return { valid: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` };
  }

  // Validate timestamp
  if (payload.timestamp === undefined || payload.timestamp === null) {
    return { valid: false, error: 'Missing required field: timestamp' };
  }
  if (typeof payload.timestamp !== 'string' || !ISO_8601_REGEX.test(payload.timestamp)) {
    return { valid: false, error: 'timestamp must be a valid ISO 8601 date-time string' };
  }

  // Validate optional course (string or null)
  if (payload.course !== undefined && payload.course !== null && typeof payload.course !== 'string') {
    return { valid: false, error: 'course must be a string or null' };
  }

  // Validate optional attendance_flag
  if (payload.attendance_flag !== undefined && payload.attendance_flag !== null) {
    if (!VALID_FLAGS.includes(payload.attendance_flag)) {
      return { valid: false, error: `attendance_flag must be one of: ${VALID_FLAGS.join(', ')} (or null)` };
    }
  }

  // Build the validated event object
  const event = {
    student_id: payload.student_id,
    student_name: payload.student_name.trim(),
    action: payload.action,
    timestamp: payload.timestamp,
    course: payload.course || null,
    attendance_flag: payload.attendance_flag || null,
  };

  return { valid: true, event };
}

module.exports = { validateEvent };

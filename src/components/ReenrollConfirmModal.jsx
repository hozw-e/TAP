import { useState, useEffect } from 'react';
import { studentsAPI } from '../services/api';
import '../styles/ConfirmModal.css';

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

/**
 * Reenroll an archived student into a (possibly new) course.
 *
 * Unlike Unarchive, this resets the student's session counter to a fresh cycle
 * and lets the admin choose the course. It reuses the same student_id, so all
 * prior attendance history stays attached and remains available to the anomaly
 * detection service.
 */
function ReenrollConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isReenrolling, setIsReenrolling] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [error, setError] = useState('');

  // Default the course picker to the student's previous course each time the
  // modal opens for a (new) student.
  useEffect(() => {
    if (isOpen && student) {
      setSelectedCourse(student.student_course || '');
      setError('');
    }
  }, [isOpen, student]);

  const handleReenroll = async () => {
    if (!selectedCourse) {
      setError('Please select a course.');
      return;
    }

    setIsReenrolling(true);
    setError('');

    try {
      const response = await studentsAPI.reenroll(student.student_id, {
        student_course: selectedCourse,
        course_duration: student.course_duration ?? null,
      });

      if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to reenroll student');
      }

      onClose();
      onSuccess('reenrolled');
    } catch (err) {
      console.error('Error reenrolling student:', err);
      onClose();
      onSuccess('reenroll_error');
    } finally {
      setIsReenrolling(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-modal-title">Reenroll this student?</h3>
        <p className="confirm-modal-message">
          {student.student_name} will be reactivated with a fresh set of 4 sessions.
          Their previous attendance history is kept for anomaly analysis.
        </p>

        <div className="confirm-modal-field">
          <label htmlFor="reenroll-course-select" className="confirm-modal-label">
            Enroll in course
          </label>
          <select
            id="reenroll-course-select"
            className="course-filter-select"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              if (error) setError('');
            }}
            disabled={isReenrolling}
          >
            <option value="">Select a course</option>
            {COURSES.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
          {error && <p className="confirm-modal-error">{error}</p>}
        </div>

        <div className="confirm-modal-buttons">
          <button
            className="confirm-btn confirm-btn-cancel"
            onClick={onClose}
            disabled={isReenrolling}
          >
            Cancel
          </button>
          <button
            className="confirm-btn confirm-btn-yes"
            onClick={handleReenroll}
            disabled={isReenrolling}
          >
            {isReenrolling ? 'Processing...' : 'Reenroll'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReenrollConfirmModal;

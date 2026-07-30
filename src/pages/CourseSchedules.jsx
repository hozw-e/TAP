import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import ConfirmModal from '../components/ConfirmModal';
import Notification from '../components/Notification';
import { courseSchedulesAPI } from '../services/api';
import '../styles/CourseSchedules.css';

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const EMPTY_FORM = {
  course_name: '',
  day_of_week: '',
  days_of_week: [],
  start_time: '',
  end_time: '',
  grace_period: 15,
};

function CourseSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification state
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const response = await courseSchedulesAPI.list();
      if (response.success) {
        setSchedules(response.data || []);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotificationMsg = (message, type = 'success') => {
    setNotification({ isOpen: true, message, type });
  };

  // Open Add modal
  const handleAddClick = () => {
    setFormMode('add');
    setFormData(EMPTY_FORM);
    setFormError('');
    setEditingId(null);
    setShowFormModal(true);
  };

  // Open Edit modal
  const handleEditClick = (schedule) => {
    setFormMode('edit');
    setFormData({
      course_name: schedule.course_name,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time?.substring(0, 5) || '',
      end_time: schedule.end_time?.substring(0, 5) || '',
      grace_period: schedule.grace_period ?? 15,
    });
    setEditingId(schedule.schedule_id);
    setFormError('');
    setShowFormModal(true);
  };

  // Open Delete modal
  const handleDeleteClick = (schedule) => {
    setDeletingSchedule(schedule);
    setShowDeleteModal(true);
  };

  // Form input change handler
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Checkbox change handler for multi-day selection
  const handleDayToggle = (day) => {
    setFormData((prev) => {
      const days = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day];
      return { ...prev, days_of_week: days };
    });
  };

  // Validate form
  const validateForm = () => {
    if (!formData.course_name) return 'Course name is required.';
    if (formMode === 'add') {
      if (formData.days_of_week.length === 0) return 'At least one day must be selected.';
    } else {
      if (!formData.day_of_week) return 'Day of week is required.';
    }
    if (!formData.start_time) return 'Start time is required.';
    if (!formData.end_time) return 'End time is required.';
    if (formData.end_time <= formData.start_time) return 'End time must be after start time.';
    const gp = parseInt(formData.grace_period, 10);
    if (isNaN(gp) || gp < 0 || gp > 120) return 'Grace period must be between 0 and 120 minutes.';
    return '';
  };

  // Submit form (create or update)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setFormLoading(true);
    setFormError('');

    const payload = {
      course_name: formData.course_name,
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      grace_period: parseInt(formData.grace_period, 10),
    };

    try {
      if (formMode === 'add') {
        // Create one schedule per selected day
        const days = formData.days_of_week;
        let successCount = 0;
        let lastError = '';

        for (const day of days) {
          const dayPayload = { ...payload, day_of_week: day };
          try {
            const response = await courseSchedulesAPI.create(dayPayload);
            if (response.success) {
              successCount++;
            } else {
              lastError = response.message || `Failed to create schedule for ${day}.`;
            }
          } catch (err) {
            lastError = err.response?.data?.message || `Failed to create schedule for ${day}.`;
          }
        }

        if (successCount === days.length) {
          showNotificationMsg(
            days.length === 1
              ? 'Schedule added successfully!'
              : `${successCount} schedules added successfully!`
          );
          setShowFormModal(false);
          loadSchedules();
        } else if (successCount > 0) {
          showNotificationMsg(
            `${successCount} of ${days.length} schedules created. Error: ${lastError}`,
            'error'
          );
          setShowFormModal(false);
          loadSchedules();
        } else {
          setFormError(lastError || 'Failed to create schedules.');
        }
      } else {
        const response = await courseSchedulesAPI.update(editingId, payload);
        if (response.success) {
          showNotificationMsg('Schedule updated successfully!');
          setShowFormModal(false);
          loadSchedules();
        } else {
          setFormError(response.message || 'Failed to update schedule.');
        }
      }
    } catch (err) {
      console.error('Form submit error:', err);
      const message = err.response?.data?.message || 'An error occurred. Please try again.';
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete confirmed
  const handleDeleteConfirm = async () => {
    if (!deletingSchedule) return;
    setDeleteLoading(true);
    try {
      const response = await courseSchedulesAPI.delete(deletingSchedule.schedule_id);
      if (response.success) {
        showNotificationMsg('Schedule deleted successfully!');
        setShowDeleteModal(false);
        setDeletingSchedule(null);
        loadSchedules();
      } else {
        showNotificationMsg(response.message || 'Failed to delete schedule.', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showNotificationMsg('Failed to delete schedule. Please try again.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Format time for display (HH:MM:SS → h:mm AM/PM)
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <AdminLayout className="course-schedules-layout">
        <div className="page-header">
          <h1>Course Schedules</h1>
        </div>
        <div className="controls-section">
          <div className="search-container" />
          <button className="add-record-btn" onClick={handleAddClick}>
            <i className="fas fa-plus"></i>
            Add Schedule
          </button>
        </div>
        <div className="students-section">
          <div className="students-header">
            <span>All Schedules</span>
          </div>
          <div className="students-body">
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading schedules...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-calendar-alt"></i>
                <p>No schedules found</p>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                  Click "Add Schedule" to create one
                </p>
              </div>
            ) : (
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Grace Period (min)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.schedule_id}>
                      <td>{schedule.course_name}</td>
                      <td>{schedule.day_of_week}</td>
                      <td>{formatTime(schedule.start_time)}</td>
                      <td>{formatTime(schedule.end_time)}</td>
                      <td>{schedule.grace_period}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn action-btn-edit"
                            onClick={() => handleEditClick(schedule)}
                            title="Edit"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="action-btn action-btn-delete"
                            onClick={() => handleDeleteClick(schedule)}
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {/* Add / Edit Schedule Modal */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-header">
              <h3>{formMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}</h3>
              <button className="schedule-modal-close" onClick={() => setShowFormModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form className="schedule-modal-form" onSubmit={handleFormSubmit}>
              {formError && <div className="schedule-form-error">{formError}</div>}

              <div className="schedule-form-group">
                <label htmlFor="course_name">Course</label>
                <select
                  id="course_name"
                  name="course_name"
                  value={formData.course_name}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select a course</option>
                  {COURSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="schedule-form-group">
                <label>{formMode === 'add' ? 'Days of Week' : 'Day of Week'}</label>
                {formMode === 'add' ? (
                  <div className="days-checkbox-group">
                    {DAYS_OF_WEEK.map((d) => (
                      <label key={d} className="day-checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.days_of_week.includes(d)}
                          onChange={() => handleDayToggle(d)}
                        />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    id="day_of_week"
                    name="day_of_week"
                    value={formData.day_of_week}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select a day</option>
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="schedule-form-row">
                <div className="schedule-form-group">
                  <label htmlFor="start_time">Start Time</label>
                  <input
                    type="time"
                    id="start_time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="schedule-form-group">
                  <label htmlFor="end_time">End Time</label>
                  <input
                    type="time"
                    id="end_time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              <div className="schedule-form-group">
                <label htmlFor="grace_period">Grace Period (minutes)</label>
                <input
                  type="number"
                  id="grace_period"
                  name="grace_period"
                  value={formData.grace_period}
                  onChange={handleFormChange}
                  min="0"
                  max="120"
                  required
                />
              </div>

              <div className="schedule-modal-buttons">
                <button
                  type="button"
                  className="schedule-btn-cancel"
                  onClick={() => setShowFormModal(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="schedule-btn-submit"
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving...' : formMode === 'add' ? 'Add' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingSchedule(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Schedule?"
        message={deletingSchedule ? `Are you sure you want to delete the ${deletingSchedule.course_name} schedule for ${deletingSchedule.day_of_week}? This action can't be undone.` : ''}
        isLoading={deleteLoading}
      />

      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        message={notification.message}
        type={notification.type}
      />
    </AdminLayout>
  );
}

export default CourseSchedules;

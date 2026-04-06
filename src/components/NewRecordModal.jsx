import { useState, useEffect } from 'react';
import { studentsAPI, guardiansAPI } from '../services/api';
import '../styles/NewRecordModal.css';

function NewRecordModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    studentName: '',
    birthdate: '',
    age: '',
    contactNumber: '',
    completeAddress: '',
    course: '',
    duration: '',
    nfcId: '',
    guardianName: '',
    guardianAddress: '',
    guardianContact: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        studentName: '',
        birthdate: '',
        age: '',
        contactNumber: '',
        completeAddress: '',
        course: '',
        duration: '',
        nfcId: '',
        guardianName: '',
        guardianAddress: '',
        guardianContact: '',
      });
      setError('');
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'birthdate' && value) {
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({
        ...prev,
        age: age >= 0 ? age.toString() : ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ✅ FIX: Validate all required fields before sending to API
    if (!formData.studentName.trim()) {
      setError('Student name is required');
      return;
    }
    if (!formData.completeAddress.trim()) {
      setError('Student address is required');
      return;
    }
    if (!formData.guardianName.trim()) {
      setError('Guardian name is required');
      return;
    }
    if (!formData.guardianContact.trim()) {
      setError('Guardian contact number is required');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create guardian first
      const guardianResponse = await guardiansAPI.create({
        guardian_name: formData.guardianName,
        guardian_cellnum: formData.guardianContact,
      });

      if (!guardianResponse.success) {
        throw new Error(guardianResponse.message || 'Failed to create guardian');
      }

      // ✅ FIX: Safely extract guardian_id from nested data object
      const guardianId = guardianResponse?.data?.guardian_id;
      if (!guardianId) {
        throw new Error('Guardian was created but ID was not returned. Please try again.');
      }

      // Step 2: Create student using the guardian_id
      const studentResponse = await studentsAPI.create({
        guardian_id: guardianId,
        student_name: formData.studentName,
        address: formData.completeAddress,
        student_cellnum: formData.contactNumber || null,
      });

      if (!studentResponse.success) {
        throw new Error(studentResponse.message || 'Failed to create student');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating record:', err);
      setError(err.message || 'Failed to create record. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="new-record-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Record Modal</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Student Profile */}
            <div className="form-section">
              <h3 className="form-section-title">Student Profile</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    name="studentName"
                    className="form-input"
                    value={formData.studentName}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row three-columns">
                <div className="form-group">
                  <label className="form-label">Birthdate</label>
                  <input
                    type="date"
                    name="birthdate"
                    className="form-input"
                    value={formData.birthdate}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    type="text"
                    name="age"
                    className="form-input"
                    value={formData.age}
                    readOnly
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input
                    type="text"
                    name="contactNumber"
                    className="form-input"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Complete Address <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    name="completeAddress"
                    className="form-input"
                    value={formData.completeAddress}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row two-columns">
                <div className="form-group">
                  <label className="form-label">Course</label>
                  <input
                    type="text"
                    name="course"
                    className="form-input"
                    value={formData.course}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <input
                    type="text"
                    name="duration"
                    className="form-input"
                    value={formData.duration}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group nfc-group">
                  <label className="form-label">NFC ID</label>
                  <div className="nfc-input-wrapper">
                    <input
                      type="text"
                      name="nfcId"
                      className="form-input"
                      value={formData.nfcId}
                      placeholder="Scan NFC card..."
                      disabled
                    />
                    <button
                      type="button"
                      className="scan-nfc-btn"
                      disabled
                    >
                      <i className="fas fa-wifi"></i> Scan NFC
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            {/* Guardian Profile */}
            <div className="form-section">
              <h3 className="form-section-title">Guardian Profile</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    name="guardianName"
                    className="form-input"
                    value={formData.guardianName}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row two-columns">
                <div className="form-group">
                  <label className="form-label">Complete Address</label>
                  <input
                    type="text"
                    name="guardianAddress"
                    className="form-input"
                    value={formData.guardianAddress}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  {/* ✅ FIX: Marked as required — backend enforces this, frontend must too */}
                  <label className="form-label">Contact Number <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    name="guardianContact"
                    className="form-input"
                    value={formData.guardianContact}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-save"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-small"></span> Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default NewRecordModal;
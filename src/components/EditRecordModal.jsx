import { useState, useEffect } from 'react';
import { studentsAPI, guardiansAPI } from '../services/api';
import '../styles/NewRecordModal.css';

function EditRecordModal({ isOpen, onClose, onSuccess, student }) {
  const [formData, setFormData] = useState({
    studentName: '',
    address: '',
    studentCellnum: '',
    guardianName: '',
    guardianCellnum: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load student data when modal opens
  useEffect(() => {
    if (isOpen && student) {
      setFormData({
        studentName: student.student_name || '',
        address: student.address || '',
        studentCellnum: student.student_cellnum || '',
        guardianName: student.guardian_name || '',
        guardianCellnum: student.guardian_cellnum || '',
      });
      setError('');
    }
  }, [isOpen, student]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.studentName.trim()) {
      setError('Student name is required');
      return;
    }
    if (!formData.guardianName.trim()) {
      setError('Guardian name is required');
      return;
    }

    setIsLoading(true);

    try {
      // Update guardian first
      const guardianResponse = await guardiansAPI.update(student.guardian_id, {
        guardian_name: formData.guardianName,
        guardian_cellnum: formData.guardianCellnum
      });

      if (!guardianResponse.success) {
        throw new Error(guardianResponse.message || 'Failed to update guardian');
      }

      // Update student
      const studentResponse = await studentsAPI.update(student.student_id, {
        student_name: formData.studentName,
        address: formData.address,
        student_cellnum: formData.studentCellnum
      });

      if (!studentResponse.success) {
        throw new Error(studentResponse.message || 'Failed to update student');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating record:', err);
      setError(err.message || 'Failed to update record. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="new-record-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Record</h2>
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
            <div className="form-section">
              <h3 className="form-section-title">Student Profile</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    name="studentName"
                    className="form-input"
                    value={formData.studentName}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Complete Address</label>
                  <input
                    type="text"
                    name="address"
                    className="form-input"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input
                    type="text"
                    name="studentCellnum"
                    className="form-input"
                    value={formData.studentCellnum}
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
                      className="form-input"
                      value={student.uid || 'Not assigned'}
                      disabled
                    />
                    <button 
                      type="button"
                      className="scan-nfc-btn"
                      disabled
                      title="NFC scanner coming soon"
                    >
                      <i className="fas fa-wifi"></i> Scan NFC
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            <div className="form-section">
              <h3 className="form-section-title">Guardian Profile</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Guardian Name *</label>
                  <input
                    type="text"
                    name="guardianName"
                    className="form-input"
                    value={formData.guardianName}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Guardian Contact Number</label>
                  <input
                    type="text"
                    name="guardianCellnum"
                    className="form-input"
                    value={formData.guardianCellnum}
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
                    <span className="spinner-small"></span> Updating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> Update Record
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditRecordModal;

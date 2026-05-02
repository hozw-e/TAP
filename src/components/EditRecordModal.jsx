import { useState, useEffect } from 'react';
import { studentsAPI, guardiansAPI, nfcAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';
import { useNFCScanner } from '../hooks/useNFCScanner';
import '../styles/NewRecordModal.css';

function EditRecordModal({ isOpen, onClose, onSuccess, student }) {
  const [formData, setFormData] = useState({
    studentName: '',
    birthdate: '',
    age: '',
    completeAddress: '',
    contactNumber: '',
    course: '',
    duration: '',
    nfcId: '',
    guardianName: '',
    guardianAddress: '',
    guardianCellnum: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);

  // Called by useNFCScanner when a UID is detected
  const handleNFCScan = async (uid) => {
    setNfcScanning(false); // Stop polling after successful scan

    try {
      const response = await nfcAPI.assign({
        student_id: student.student_id,
        uid,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to assign NFC tag');
      }

      setFormData(prev => ({ ...prev, nfcId: uid }));
    } catch (err) {
      setError(err.message || 'Failed to assign NFC tag. Please try again.');
    }
  };

  const { isPolling } = useNFCScanner(nfcScanning, handleNFCScan);

  const handleScanNFC = () => {
    setNfcScanning(prev => !prev);
  };

  useEffect(() => {
    if (isOpen && student) {
      // Recalculate age from birthdate so it's always accurate on load
      let ageValue = '';
      if (student.student_birthdate) {
        const today = new Date();
        const birthDate = new Date(student.student_birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        ageValue = age >= 0 ? String(age) : '';
      }

      setFormData({
        studentName:     student.student_name      || '',
        birthdate:       student.student_birthdate || '',
        age:             ageValue,
        completeAddress: student.student_address   || '',
        contactNumber:   student.student_cellnum   || '',
        course:          student.student_course    || '',
        duration:        student.course_duration   || '',
        nfcId:           student.nfc_uid           || '',
        guardianName:    student.guardian_name     || '',
        guardianAddress: student.guardian_address  || '',
        guardianCellnum: student.guardian_cellnum  || '',
      });
      setError('');
      setShowConfirm(false);
    }
  }, [isOpen, student]);

  useEffect(() => {
    console.log('FormData updated:', formData); // Debugging log
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'birthdate' && value) {
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      console.log('Birthdate:', value, 'Age:', age); // Debugging log
      setFormData(prev => ({
        ...prev,
        birthdate: value,
        age: age >= 0 ? String(age) : ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

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

    setShowConfirm(true);
  };

  const handleConfirmUpdate = async () => {
    setIsLoading(true);

    try {
      const guardianResponse = await guardiansAPI.update(student.guardian_id, {
        guardian_name: formData.guardianName,
        guardian_address: formData.guardianAddress || null,
        guardian_cellnum: formData.guardianCellnum || null,
      });

      if (!guardianResponse.success) {
        throw new Error(guardianResponse.message || 'Failed to update guardian');
      }

      const studentResponse = await studentsAPI.update(student.student_id, {
        student_name: formData.studentName,
        student_birthdate: formData.birthdate || null,
        student_address: formData.completeAddress,
        student_cellnum: formData.contactNumber || null,
        student_course: formData.course || null,
        course_duration: formData.duration || null,
      });

      if (!studentResponse.success) {
        throw new Error(studentResponse.message || 'Failed to update student');
      }

      setShowConfirm(false);
      onSuccess('updated'); // Pass action type
      onClose();
    } catch (err) {
      console.error('Error updating record:', err);
      setError(err.message || 'Failed to update record. Please try again.');
      setShowConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <>
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

            <form onSubmit={handleFormSubmit}>
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
                        placeholder={isPolling ? "Waiting for NFC scan..." : "Scan NFC card..."}
                        readOnly
                      />
                      <button 
                        type="button" 
                        className={`scan-nfc-btn ${isPolling ? 'scanning' : ''}`}
                        onClick={handleScanNFC}
                      >
                        <i className="fas fa-wifi"></i> 
                        {isPolling ? 'Stop Scan' : 'Scan NFC'}
                      </button>
                    </div>
                    {isPolling && (
                      <small className="form-hint scanning-hint">
                        <i className="fas fa-spinner fa-spin"></i> Listening for NFC card...
                      </small>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-divider"></div>

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
                    <label className="form-label">Contact Number</label>
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
                <button type="submit" className="btn btn-save" disabled={isLoading}>
                  <i className="fas fa-check"></i> Update Record
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmUpdate}
        title="Save updates?"
        isLoading={isLoading}
      />
    </>
  );
}

export default EditRecordModal;
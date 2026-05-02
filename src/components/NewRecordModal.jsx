import { useState, useEffect } from 'react';
import { studentsAPI, guardiansAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';
import { useNFCScanner } from '../hooks/useNFCScanner';
import '../styles/NewRecordModal.css';
import axios from 'axios';

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // NFC Scanner Hook
  const { isPolling } = useNFCScanner(isScanning, (uid, unassigned) => {
    // NFC card scanned!
    setFormData(prev => ({
      ...prev,
      nfcId: uid
    }));
    setIsScanning(false); // Stop scanning after successful scan
  });

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
      setShowConfirm(false);
      setIsScanning(false);
    }
  }, [isOpen]);

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

  const handleScanNFC = () => {
    setIsScanning(!isScanning);
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
    if (!formData.guardianContact.trim()) {
      setError('Guardian contact number is required');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
  setIsLoading(true);

  try {
    const guardianResponse = await guardiansAPI.create({
      guardian_name: formData.guardianName,
      guardian_address: formData.guardianAddress || null,
      guardian_cellnum: formData.guardianContact,
    });

    if (!guardianResponse.success) {
      throw new Error(guardianResponse.message || 'Failed to create guardian');
    }

    const guardianId = guardianResponse?.data?.guardian_id;
    if (!guardianId) {
      throw new Error('Guardian was created but ID was not returned.');
    }

    const studentResponse = await studentsAPI.create({
      guardian_id: guardianId,
      student_name: formData.studentName,
      student_birthdate: formData.birthdate || null,
      student_address: formData.completeAddress,
      student_cellnum: formData.contactNumber || null,
      student_course: formData.course || null,
      course_duration: formData.duration || null,
    });

    if (!studentResponse.success) {
      throw new Error(studentResponse.message || 'Failed to create student');
    }

    // If NFC ID was scanned, assign it to the student
    if (formData.nfcId) {
      const studentId = studentResponse.data.student_id;
      try {
        await axios.post('http://localhost/apdc/backend/api/nfc/assign.php', {
          student_id: studentId,
          uid: formData.nfcId
        });
        console.log('NFC tag assigned successfully');
      } catch (nfcError) {
        console.error('Failed to assign NFC tag:', nfcError);
        // Don't fail the whole operation if NFC assignment fails
      }
    }

    setShowConfirm(false);
    onSuccess('added');
    onClose();
  } catch (err) {  // ✅ THIS IS CORRECT - catch is part of the outer try block
    console.error('Error creating record:', err);
    setError(err.message || 'Failed to create record. Please try again.');
    setShowConfirm(false);
  } finally {
    setIsLoading(false);
  }
};

  if (!isOpen) return null;

  return (
    <>
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
                <button type="submit" className="btn btn-save" disabled={isLoading}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSave}
        title="Continue adding new record?"
        isLoading={isLoading}
      />
    </>
  );
}

export default NewRecordModal;
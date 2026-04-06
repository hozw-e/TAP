import { useState } from 'react';
import { studentsAPI } from '../services/api';
import '../styles/DeleteModal.css';

function DeleteConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);

    try {
      const response = await studentsAPI.delete(student.student_id);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete student');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error deleting student:', err);
      setError(err.message || 'Failed to delete student. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="delete-icon">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        
        <h2 className="delete-modal-title">Delete Student Record?</h2>
        
        <p className="delete-modal-message">
          Are you sure you want to delete <strong>{student.student_name}</strong>?
          This action cannot be undone.
        </p>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <div className="delete-modal-buttons">
          <button
            className="btn btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="btn btn-delete"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="spinner-small"></span> Deleting...
              </>
            ) : (
              <>
                <i className="fas fa-trash"></i> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;

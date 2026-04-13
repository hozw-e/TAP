import { useState } from 'react';
import { studentsAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';

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

      onSuccess('deleted'); // Pass action type
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
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Continue deleting record?"
      message={error || "This action can't be undone."}
      isLoading={isDeleting}
    />
  );
}

export default DeleteConfirmModal;
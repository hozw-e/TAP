import { useState } from 'react';
import { studentsAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';

function UnarchiveConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [error, setError] = useState('');

  const handleUnarchive = async () => {
    setError('');
    setIsUnarchiving(true);

    try {
      const response = await studentsAPI.unarchive(student.student_id);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to unarchive student');
      }

      onSuccess('unarchived');
      onClose();
    } catch (err) {
      console.error('Error unarchiving student:', err);
      setError(err.message || 'Failed to unarchive student. Please try again.');
    } finally {
      setIsUnarchiving(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleUnarchive}
      title="Unarchive this student?"
      message={error || "The student will be restored to active students."}
      isLoading={isUnarchiving}
    />
  );
}

export default UnarchiveConfirmModal;

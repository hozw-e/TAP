import { useState } from 'react';
import { studentsAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';

function UnarchiveConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  const handleUnarchive = async () => {
    setIsUnarchiving(true);

    try {
      const response = await studentsAPI.unarchive(student.student_id);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to unarchive student');
      }

      // Close modal first, then show success notification
      onClose();
      onSuccess('unarchived');
    } catch (err) {
      console.error('Error unarchiving student:', err);
      // Close modal and show error notification
      onClose();
      onSuccess('unarchive_error');
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
      message="The student will be restored to active students."
      isLoading={isUnarchiving}
    />
  );
}

export default UnarchiveConfirmModal;

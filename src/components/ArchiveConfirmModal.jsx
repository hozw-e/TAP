import { useState } from 'react';
import { studentsAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';

function ArchiveConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState('');

  const handleArchive = async () => {
    setError('');
    setIsArchiving(true);

    try {
      const response = await studentsAPI.archive(student.student_id);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to archive student');
      }

      onSuccess('archived');
      onClose();
    } catch (err) {
      console.error('Error archiving student:', err);
      setError(err.message || 'Failed to archive student. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleArchive}
      title="Archive this student?"
      message={error || "The student will be moved to archived students. You can unarchive them later."}
      isLoading={isArchiving}
    />
  );
}

export default ArchiveConfirmModal;

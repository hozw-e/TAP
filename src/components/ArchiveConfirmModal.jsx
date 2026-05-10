import { useState } from 'react';
import { studentsAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';

function ArchiveConfirmModal({ isOpen, onClose, onSuccess, student }) {
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);

    try {
      const response = await studentsAPI.archive(student.student_id);
      
      console.log('Archive response:', response); // Debug log
      
      if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to archive student');
      }

      // Close modal first, then show success notification
      onClose();
      onSuccess('archived');
    } catch (err) {
      console.error('Error archiving student:', err);
      // Close modal and show error notification
      onClose();
      onSuccess('archive_error');
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
      message="The student will be moved to archived students. You can unarchive them later."
      isLoading={isArchiving}
    />
  );
}

export default ArchiveConfirmModal;

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import NewRecordModal from '../components/NewRecordModal';
import EditRecordModal from '../components/EditRecordModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import Notification from '../components/Notification';
import { studentsAPI } from '../services/api';
import '../styles/Students.css';

function Students() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Notification state
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (!Array.isArray(students)) return;

    const filtered = students.filter(student =>
      student.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.guardian_name && student.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await studentsAPI.list();

      const studentsData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

      if (response?.success) {
        setStudents(studentsData);
        setFilteredStudents(studentsData);
      } else {
        setStudents([]);
        setFilteredStudents([]);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
      setFilteredStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total hours (placeholder - you can implement actual logic)
  const calculateTotalHours = (student) => {
    // TODO: Calculate from attendance_logs
    return '0 hours';
  };

  const showNotification = (action) => {
    const messages = {
      added: 'New record added successfully!',
      updated: 'Record updated successfully!',
      deleted: 'Record deleted successfully!'
    };

    setNotification({
      isOpen: true,
      message: messages[action] || 'Action completed successfully!',
      type: 'success'
    });
  };

  const handleNewRecordSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setShowEditModal(true);
  };

  const handleEditSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  const handleDeleteClick = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  const handleDeleteSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">
        <div className="page-header">
          <h1>Student Records</h1>
        </div>
        <div className="controls-section">
          <div className="search-container">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="add-record-btn" onClick={() => setShowNewRecordModal(true)}>
            <i className="fas fa-plus"></i>
            New record
          </button>
        </div>
        <div className="students-section">
          <div className="students-header">Students</div>
          <div className="students-body">
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-users"></i>
                <p>No students found</p>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                  {searchTerm ? 'Try a different search term' : 'Click "New record" to add a student'}
                </p>
              </div>
            ) : (
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Course</th>
                    <th>Duration</th>
                    <th>Total Hours</th>
                    <th>Guardian</th>
                    <th>Contact Number</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.student_id}>
                      <td>{student.student_name}</td>
                      <td>{student.student_course || '-'}</td>
                      <td>{student.course_duration || '-'}</td>
                      <td>{calculateTotalHours(student)}</td>
                      <td>{student.guardian_name || '-'}</td>
                      <td>{student.guardian_cellnum || '-'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn action-btn-edit" onClick={() => handleEditClick(student)} title="Edit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="action-btn action-btn-delete" onClick={() => handleDeleteClick(student)} title="Delete">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
      <NewRecordModal isOpen={showNewRecordModal} onClose={() => setShowNewRecordModal(false)} onSuccess={handleNewRecordSuccess} />
      <EditRecordModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSuccess={handleEditSuccess} student={selectedStudent} />
      <DeleteConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onSuccess={handleDeleteSuccess} student={selectedStudent} />
      <Notification isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} message={notification.message} type={notification.type} />
    </div>
  );
}

export default Students;
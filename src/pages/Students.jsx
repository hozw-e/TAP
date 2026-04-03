import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import NewRecordModal from '../components/NewRecordModal';
import EditRecordModal from '../components/EditRecordModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
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

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    // ✅ FIX: Guard students with Array.isArray before calling .filter()
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

      // ✅ FIX: Safely extract array — handles flat array or nested under .data.data
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

  const handleNewRecordSuccess = () => {
    loadStudents();
  };

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    loadStudents();
  };

  const handleDeleteClick = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  const handleDeleteSuccess = () => {
    loadStudents();
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />

      <div className="main-content">
        <div className="page-header">
          <h1>Student Records</h1>
        </div>

        {/* Search and Add Controls */}
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
          <button
            className="add-record-btn"
            onClick={() => setShowNewRecordModal(true)}
          >
            <i className="fas fa-plus"></i>
            New record
          </button>
        </div>

        {/* Students Table */}
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
                    <th>Name</th>
                    <th>Status</th>
                    <th>Guardian</th>
                    <th>Guardian's Contact</th>
                    <th>NFC ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.student_id}>
                      <td>{student.student_name}</td>
                      <td>
                        <span className="status-badge status-active">ACTIVE</span>
                      </td>
                      <td>{student.guardian_name || '-'}</td>
                      <td>{student.guardian_cellnum || '-'}</td>
                      <td>
                        {student.uid ? (
                          <span className="nfc-badge">{student.uid}</span>
                        ) : (
                          <span className="nfc-badge nfc-unassigned">Not assigned</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn action-btn-edit"
                            onClick={() => handleEditClick(student)}
                            title="Edit"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="action-btn action-btn-delete"
                            onClick={() => handleDeleteClick(student)}
                            title="Delete"
                          >
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

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
      />

      <NewRecordModal
        isOpen={showNewRecordModal}
        onClose={() => setShowNewRecordModal(false)}
        onSuccess={handleNewRecordSuccess}
      />

      <EditRecordModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        student={selectedStudent}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={handleDeleteSuccess}
        student={selectedStudent}
      />
    </div>
  );
}

export default Students;
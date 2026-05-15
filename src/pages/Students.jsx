import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import NewRecordModal from '../components/NewRecordModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';
import UnarchiveConfirmModal from '../components/UnarchiveConfirmModal';
import Notification from '../components/Notification';
import { studentsAPI } from '../services/api';
import TopBar from '../components/TopBar';
import '../styles/Students.css';

const COURSES = [
  'Basic Coding', 'Research', 'EV3', 'Rover 2',
  'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'
];

function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
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
  }, [showArchived]); // Reload when toggling between active/archived

  useEffect(() => {
    if (!Array.isArray(students)) return;

    const filtered = students.filter(student => {
      const matchesSearch =
        student.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.guardian_name && student.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCourse = courseFilter === '' || student.student_course === courseFilter;

      return matchesSearch && matchesCourse;
    });
    setFilteredStudents(filtered);
  }, [searchTerm, courseFilter, students]);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await studentsAPI.list(showArchived);

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
      deleted: 'Record deleted successfully!',
      archived: 'Student archived successfully!',
      unarchived: 'Student unarchived successfully!',
      archive_error: 'Failed to archive student. Please try again.',
      unarchive_error: 'Failed to unarchive student. Please try again.'
    };

    const type = action.includes('error') ? 'error' : 'success';

    setNotification({
      isOpen: true,
      message: messages[action] || 'Action completed successfully!',
      type: type
    });
  };

  const handleNewRecordSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  const handleEditClick = (student) => {
    navigate(`/students/${student.student_id}/edit`, { state: { student } });
  };

  const handleViewClick = (student) => {
    navigate(`/students/${student.student_id}`, { state: { student } });
  };

  const handleDeleteClick = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  const handleArchiveClick = (student) => {
    setSelectedStudent(student);
    setShowArchiveModal(true);
  };

  const handleUnarchiveClick = (student) => {
    setSelectedStudent(student);
    setShowUnarchiveModal(true);
  };

  const handleDeleteSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  const handleArchiveSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  const handleUnarchiveSuccess = (action) => {
    loadStudents();
    showNotification(action);
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />
      <div className="main-content">
        <TopBar />
        <div className="page-header">
          <h1>Student Records</h1>
        </div>
        <div className="controls-section">
          <div className="search-container">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Search students"
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
          <div className="students-header">
            <span>{showArchived ? 'Archived Students' : 'Active Students'}</span>
            <div className="students-header-actions">
              <select
                className="course-filter-select"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="">All Courses</option>
                {COURSES.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
              <button 
                className="toggle-archive-btn" 
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'See Active' : 'See Archived'}
              </button>
            </div>
          </div>
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
                {searchTerm ? (
                  <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    Try a different search term
                  </p>
                ) : !showArchived ? (
                  <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    Click "New record" to add a student
                  </p>
                ) : null}
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
                          {!showArchived ? (
                            <>
                              <button className="action-btn action-btn-view" onClick={() => handleViewClick(student)} title="View Record">
                                <i className="fas fa-eye"></i>
                              </button>
                              <button className="action-btn action-btn-edit" onClick={() => handleEditClick(student)} title="Edit">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="action-btn action-btn-archive" onClick={() => handleArchiveClick(student)} title="Archive">
                                <i className="fas fa-archive"></i>
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="action-btn action-btn-unarchive" onClick={() => handleUnarchiveClick(student)} title="Unarchive">
                                <i className="fas fa-undo"></i>
                              </button>
                              <button className="action-btn action-btn-delete" onClick={() => handleDeleteClick(student)} title="Delete">
                                <i className="fas fa-trash"></i>
                              </button>
                            </>
                          )}
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
      <DeleteConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onSuccess={handleDeleteSuccess} student={selectedStudent} />
      <ArchiveConfirmModal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} onSuccess={handleArchiveSuccess} student={selectedStudent} />
      <UnarchiveConfirmModal isOpen={showUnarchiveModal} onClose={() => setShowUnarchiveModal(false)} onSuccess={handleUnarchiveSuccess} student={selectedStudent} />
      <Notification isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} message={notification.message} type={notification.type} />
    </div>
  );
}

export default Students;
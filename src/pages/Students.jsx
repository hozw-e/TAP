import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LogoutModal from '../components/LogoutModal';
import { studentsAPI } from '../services/api';
import '../styles/Students.css';

function Students() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    // Filter students based on search term
    const filtered = students.filter(student => 
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.guardian_name && student.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await studentsAPI.list();
      if (response.success) {
        setStudents(response.data);
        setFilteredStudents(response.data);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="students-layout">
      <Sidebar onLogoutClick={() => setShowLogoutModal(true)} />

      <div className="main-content">
        <div className="page-header">
          <h1>Students</h1>
          <p>Manage student records and information</p>
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
          <button className="add-record-btn" onClick={() => alert('New Record Modal - Coming in full version!')}>
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
                    <th>Total Hours Present</th>
                    <th>Guardian</th>
                    <th>Guardian's Contact Number</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.student_id}>
                      <td>{student.student_name}</td>
                      <td>
                        <span className="status-badge status-active">ACTIVE</span>
                      </td>
                      <td>0 hrs</td>
                      <td>{student.guardian_name || '-'}</td>
                      <td>{student.guardian_cellnum || '-'}</td>
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
    </div>
  );
}

export default Students;

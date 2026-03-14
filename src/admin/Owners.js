import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import AdminNavbar from './AdminNavbar';
import './Users.css'; // We'll reuse the Users CSS styling

function Owners() {
  const { isAuthenticated, isAdmin, getRoleToken } = useAuth();
  const navigate = useNavigate();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/admin-login');
      return;
    }

    const fetchOwners = async () => {
      try {
        const token = getRoleToken('admin') || localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/admin/owners', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOwners(res.data.owners || []);
        setError(''); // Clear any previous errors
      } catch (err) {
        console.error('Failed to fetch owners:', err);
        setError(err.response?.data?.message || 'Failed to load owners');
      } finally {
        setLoading(false);
      }
    };

    fetchOwners();

    // Set up auto-refresh every 2 seconds
    const interval = setInterval(fetchOwners, 2000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [isAuthenticated, isAdmin, navigate, getRoleToken]);

  const handleDeleteOwner = async (ownerId) => {
    if (!window.confirm('Are you sure you want to delete this owner? This will also affect their pets.')) {
      return;
    }

    try {
      const token = getRoleToken('admin') || localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/owners/${ownerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove the deleted owner from the state
      setOwners(owners.filter(owner => owner._id !== ownerId));
      alert('Owner deleted successfully');
    } catch (err) {
      console.error('Failed to delete owner:', err);
      alert(err.response?.data?.message || 'Failed to delete owner');
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div>
        <AdminNavbar />
        <div className="main-content">
          <div className="page-container">
            <div className="loading">Loading owners...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavbar />
      <div className="main-content">
        <div className="page-container">
          <h1>Pet Owners Management</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="stats-cards">
            <div className="stat-card">
              <h3>Total Owners</h3>
              <p className="stat-number">{owners.length}</p>
            </div>
            <div className="stat-card">
              <h3>Active Owners</h3>
              <p className="stat-number">{owners.filter(owner => owner.pets && owner.pets.length > 0).length}</p>
            </div>
          </div>

          {owners.length === 0 ? (
            <div className="no-data">
              <p>No owners found in the system.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Pets Count</th>
                    <th>Join Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => (
                    <tr key={owner._id}>
                      <td>{owner.name}</td>
                      <td>{owner.email}</td>
                      <td>{owner.phone || 'Not provided'}</td>
                      <td>{owner.pets ? owner.pets.length : 0}</td>
                      <td>{new Date(owner.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="view-btn"
                            onClick={() => navigate(`/admin/owner-details/${owner._id}`)}
                            title="View Details"
                          >
                            View
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteOwner(owner._id)}
                            title="Delete Owner"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Owners;

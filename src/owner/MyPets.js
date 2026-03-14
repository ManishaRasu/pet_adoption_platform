import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import OwnerNavbar from './OwnerNavbar';
import './MyPets.css';

function MyPets() {
  const { isAuthenticated, isOwner, getRoleToken } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isOwner) {
      navigate('/owner-login');
      return;
    }
    const fetchPets = async () => {
      try {
        // Try owner token first, fallback to general token
        const token = getRoleToken('owner') || localStorage.getItem('token');
        console.log('MyPets - Token:', token ? 'Present' : 'Missing');

        // Debug token payload
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('MyPets - Token payload:', payload);
            console.log('MyPets - User role:', payload.role);
          } catch (e) {
            console.log('MyPets - Invalid token format');
          }
        }

        const res = await axios.get('http://localhost:5000/api/owner/pets', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('MyPets - API response:', res.data);
        setPets(res.data.pets || []);
      } catch (err) {
        console.error('MyPets - Fetch error:', err);
        console.error('MyPets - Error status:', err.response?.status);
        console.error('MyPets - Error data:', err.response?.data);
        setError('Failed to load pets');
      } finally {
        setLoading(false);
      }
    };
    fetchPets();

    // Set up auto-refresh every 3 seconds
    const interval = setInterval(fetchPets, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [isAuthenticated, isOwner, navigate, getRoleToken]);

  const refresh = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/owner/pets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPets(res.data.pets || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pet?')) return;

    try {
      const token = getRoleToken('owner') || localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/owner/pets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      refresh();
    } catch (error) {
      console.error('Delete error:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to delete pet');
    }
  };

  const handleMarkSold = async (id) => {
    try {
      const token = getRoleToken('owner') || localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/owner/pets/${id}/mark-sold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      refresh();
    } catch (error) {
      console.error('Mark sold error:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to mark pet as sold');
    }
  };

  if (!isAuthenticated || !isOwner) return null;
  if (loading) return (
    <div>
      <OwnerNavbar />
      <div className="main-content owner-main">
        <div className="page-container">
          <div className="loading">Loading your pets...</div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <OwnerNavbar />
      <div className="main-content owner-main">
        <div className="page-container">
          <div className="page-header">
            <h1>My Pets</h1>
            <button className="submit-btn" onClick={() => navigate('/owner/add-pet')}>
              ➕ Add New Pet
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
          {pets.length === 0 ? (
            <div className="empty-state">
              <p>No pets yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="pets-grid">
              {pets.map(p => (
                <div className={`pet-card ${p.status}`} key={p._id}>
                  <div className="pet-image">
                    <img src={p.image} alt={p.name} />
                    <div className={`status-badge ${p.status}`}>{p.status}</div>
                  </div>
                  <div className="pet-info">
                    <h3>{p.name}</h3>
                    <p>{p.breed} • {p.age} years • {p.gender}</p>
                    <p><strong>Type:</strong> {p.type}</p>
                    <p>
                      <strong>Listing:</strong>
                      <span className={`listing-badge ${p.listingType}`}>
                        {p.listingType}
                      </span>
                      {p.listingType === 'sale' && p.price && (
                        <span className="price-display"> • ₹{p.price}</span>
                      )}
                    </p>

                    {/* Show adoption/purchase details */}
                    {(p.status === 'adopted' || p.status === 'sold') && p.adoptedBy && (
                      <div className="adoption-details" style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#f0f8ff',
                        borderRadius: '5px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#2c5530' }}>
                          {p.status === 'sold' ? 'Sold to:' : 'Adopted by:'}
                        </h4>
                        <p style={{ margin: '2px 0' }}><strong>Name:</strong> {p.adoptedBy.name}</p>
                        <p style={{ margin: '2px 0' }}><strong>Email:</strong> {p.adoptedBy.email}</p>
                        {p.adoptedBy.phone && (
                          <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {p.adoptedBy.phone}</p>
                        )}
                        <p style={{ margin: '2px 0' }}><strong>Date:</strong> {
                          p.adoptedAt ? new Date(p.adoptedAt).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : new Date(p.updatedAt).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        }</p>
                      </div>
                    )}
                  </div>
                  <div className="card-actions">
                    <button className="submit-btn" onClick={() => navigate(`/owner/edit-pet/${p._id}`)}>
                      ✏️ Edit
                    </button>
                    <button className="cancel-btn" onClick={() => handleDelete(p._id)}>
                      🗑️ Delete
                    </button>
                    {p.listingType === 'sale' && p.status !== 'sold' && (
                      <button className="mark-sold-btn" onClick={() => handleMarkSold(p._id)}>
                        💰 Mark Sold
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyPets;

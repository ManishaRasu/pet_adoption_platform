import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import axios from 'axios';
import AdminNavbar from './AdminNavbar';
import './EditPet.css';

function EditPet() {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [showChangeImage, setShowChangeImage] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    age: '',
    type: '',
    gender: '',
    description: '',
    image: '',
    status: 'available',
    adoptedBy: null,
    listingType: 'adoption',
    price: ''
  });

  React.useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/admin-login');
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchPetData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching pet data - Token:', token ? 'Present' : 'Missing');

      const response = await axios.get(`http://localhost:5000/api/pets/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('Pet data response:', response.data);
      const pet = response.data;
      setFormData({
        name: pet.name || '',
        breed: pet.breed || '',
        age: pet.age || '',
        type: pet.type || '',
        gender: pet.gender || '',
        description: pet.description || '',
        image: pet.image || '',
        status: pet.status || 'available',
        adoptedBy: pet.adoptedBy || null,
        listingType: pet.listingType || 'adoption',
        price: pet.price || ''
      });
    } catch (error) {
      console.error('Error fetching pet:', error);
      setError('Failed to fetch pet data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPetData();
  }, [fetchPetData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size should be less than 5MB');
        return;
      }

      setNewImageFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelImageChange = () => {
    setShowChangeImage(false);
    setNewImageFile(null);
    setNewImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('image');
    if (fileInput) fileInput.value = '';
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Pet name is required';
    if (!formData.type) errors.type = 'Pet type is required';
    if (!formData.breed?.trim()) errors.breed = 'Breed is required';
    if (!formData.age || formData.age <= 0) errors.age = 'Valid age is required';
    if (!formData.gender) errors.gender = 'Gender is required';
    if (!formData.description?.trim()) errors.description = 'Description is required';
    if (!formData.image && !newImageFile) errors.image = 'Pet image is required';
    if (formData.listingType === 'sale' && (!formData.price || Number(formData.price) <= 0)) {
      errors.price = 'Valid price is required for sale listings';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    setSaving(true);
    setValidationErrors({});

    try {
      const token = localStorage.getItem('token');
      console.log('Update pet - Token:', token ? 'Present' : 'Missing');
      console.log('Update pet - Current user:', { isAuthenticated, isAdmin });

      let requestData;
      let headers = {
        Authorization: `Bearer ${token}`
      };

      if (newImageFile) {
        // If new image is selected, use FormData
        requestData = new FormData();
        requestData.append('name', formData.name.trim());
        requestData.append('breed', formData.breed.trim());
        requestData.append('age', formData.age.toString());
        requestData.append('type', formData.type);
        requestData.append('gender', formData.gender);
        requestData.append('description', formData.description.trim());
        requestData.append('status', formData.status);
        requestData.append('listingType', formData.listingType);
        if (formData.listingType === 'sale') {
          requestData.append('price', formData.price);
        }
        requestData.append('image', newImageFile);
        // Don't set Content-Type for FormData, let axios handle it
      } else {
        // If keeping existing image, use JSON
        requestData = {
          name: formData.name.trim(),
          breed: formData.breed.trim(),
          age: parseInt(formData.age),
          type: formData.type,
          gender: formData.gender,
          description: formData.description.trim(),
          status: formData.status,
          listingType: formData.listingType,
          ...(formData.listingType === 'sale' && { price: formData.price })
          // Don't include image field to keep existing image
        };
        headers['Content-Type'] = 'application/json';
      }

      console.log('Sending update data:', newImageFile ? 'FormData with new image' : requestData);

      const response = await axios.put(`http://localhost:5000/api/pets/${id}`, requestData, {
        headers: headers
      });

      console.log('Update response:', response.data);
      setSuccess('Pet updated successfully! ✓ Redirecting...');
      setTimeout(() => {
        navigate('/admin/view-pets');
      }, 2000);
    } catch (error) {
      console.error('Update error:', error);
      console.error('Error response:', error.response?.data);
      setSaving(false);
      const errorMessage = error.response?.data?.message || 'Failed to update pet. Please try again.';
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    navigate('/admin/view-pets');
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="edit-pet-container">
        <AdminNavbar />
        <div className="loading">Loading pet data...</div>
      </div>
    );
  }

  return (
    <div className="edit-pet-container">
      <AdminNavbar />
      <div className="edit-pet-content">
        <div className="edit-pet-header">
          <h1>Edit Pet</h1>
          <p>Update pet information</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="edit-pet-form-container">
          <form onSubmit={handleSubmit} className="edit-pet-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Pet Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter pet name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="breed">Breed *</label>
                <input
                  type="text"
                  id="breed"
                  name="breed"
                  value={formData.breed}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter pet breed"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="age">Age (years) *</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="30"
                  placeholder="Enter pet age"
                />
              </div>

              <div className="form-group">
                <label htmlFor="type">Pet Type *</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Pet Type</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Bird">Bird</option>
                  <option value="Rabbit">Rabbit</option>
                  <option value="Fish">Fish</option>
                  <option value="Hamster">Hamster</option>
                  <option value="Guinea Pig">Guinea Pig</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>


            <div className="form-group">
              <label htmlFor="gender">Gender *</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="4"
                placeholder="Describe the pet's personality, habits, and any special needs..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="listingType">Listing Type *</label>
                <select
                  id="listingType"
                  name="listingType"
                  value={formData.listingType}
                  onChange={handleInputChange}
                  required
                >
                  <option value="adoption">Adoption</option>
                  <option value="sale">Sale</option>
                </select>
              </div>

              {formData.listingType === 'sale' && (
                <div className="form-group">
                  <label htmlFor="price">Price (₹) *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required={formData.listingType === 'sale'}
                    min="1"
                    placeholder="Enter price in rupees"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="image">Pet Image *</label>

              {/* Show current image */}
              {formData.image && !showChangeImage && (
                <div className="current-image-section">
                  <div className="current-image-preview">
                    <img
                      src={formData.image}
                      alt="Current pet"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #e0e0e0'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChangeImage(true)}
                    className="change-image-btn"
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Change Image
                  </button>
                </div>
              )}

              {/* Show image upload when changing image or no current image */}
              {(showChangeImage || !formData.image) && (
                <div className="image-upload-section">
                  <input
                    type="file"
                    id="image"
                    name="image"
                    onChange={handleImageChange}
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                  />
                  <small className="form-note">
                    Please select an image file (JPEG, PNG, or GIF). Max size: 5MB
                  </small>

                  {newImagePreview && (
                    <div className="image-preview">
                      <img
                        src={newImagePreview}
                        alt="New pet preview"
                        style={{
                          maxWidth: '200px',
                          maxHeight: '200px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          marginTop: '10px',
                          border: '2px solid #e0e0e0'
                        }}
                      />
                    </div>
                  )}

                  {showChangeImage && (
                    <button
                      type="button"
                      onClick={handleCancelImageChange}
                      className="cancel-change-btn"
                      style={{
                        marginTop: '10px',
                        marginLeft: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel Change
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="available">Available for Adoption</option>
                <option value="adopted">Adopted</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleCancel} className="cancel-btn">
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? 'Updating...' : 'Update Pet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditPet;

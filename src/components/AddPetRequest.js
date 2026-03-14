import React, { useState } from 'react';
import './AddPetsRequest.css';
import axios from 'axios';

function AddPetRequest() {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    breed: '',
    age: '',
    gender: '',
    description: '',
    listingType: 'adoption',
    price: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState('');
  const [, setSuccess] = useState('');
  // Location state
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Debug: log changes so we can confirm events are firing in the browser
    // (Will appear in devtools console when typing)
    // eslint-disable-next-line no-console
    console.log('AddPetRequest.handleChange', name, value);
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUseMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        // eslint-disable-next-line no-console
        console.log('AddPetRequest.handleUseMyLocation success', { lat, lng });
        setLatitude(lat);
        setLongitude(lng);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || 'Failed to get location');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleLatitudeChange = (e) => {
    const val = e.target.value;
    // eslint-disable-next-line no-console
    console.log('AddPetRequest.latitude change', val);
    setLatitude(val);
  };

  const handleLongitudeChange = (e) => {
    const val = e.target.value;
    // eslint-disable-next-line no-console
    console.log('AddPetRequest.longitude change', val);
    setLongitude(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    if (!imageFile) {
      setLoading(false);
      alert('Please select an image file');
      return;
    }
    if (formData.listingType === 'sale' && (!formData.price || Number(formData.price) <= 0)) {
      setLoading(false);
      alert('Please enter a valid price for sale listings');
      return;
    }
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('type', formData.type);
      formDataToSend.append('breed', formData.breed);
      formDataToSend.append('age', formData.age);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('listingType', formData.listingType);
      if (formData.listingType === 'sale') {
        formDataToSend.append('price', formData.price);
      }
      if (latitude && longitude) {
        formDataToSend.append('lat', latitude);
        formDataToSend.append('lng', longitude);
      }
      formDataToSend.append('image', imageFile);

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      await axios.post('http://localhost:5000/api/pet-requests', formDataToSend, { headers });
      alert('Pet request sent successfully!');
      setFormData({ name: '', type: '', breed: '', age: '', gender: '', description: '', listingType: 'adoption', price: '' });
      setImageFile(null);
      setImagePreview(null);
      setLatitude('');
      setLongitude('');
      const fileInput = document.getElementById('image');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send pet request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    setFormData({ name: '', type: '', breed: '', age: '', gender: '', description: '', listingType: 'adoption', price: '' });
    setImageFile(null);
    setImagePreview(null);
    setLatitude('');
    setLongitude('');
    setError('');
    setSuccess('');
    const fileInput = document.getElementById('image');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="add-pet-container">
      <div className="add-pet-content">
        <div className="add-pet-header">
          <h1>Send Pet Request</h1>
          <p>Request to add a new pet for adoption</p>
        </div>
        <div className="add-pet-form-container">
          <form onSubmit={handleSubmit} className="add-pet-form">
            <div className="form-group">
              <label htmlFor="name">Pet Name *</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} onInput={handleChange} required placeholder="Enter pet name" />
            </div>
            <div className="form-group">
              <label htmlFor="type">Pet Type *</label>
              <select id="type" name="type" value={formData.type} onChange={handleChange} onInput={handleChange} required>
                <option value="">Select pet type</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Bird">Bird</option>
                <option value="Rabbit">Rabbit</option>
                <option value="Fish">Fish</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="breed">Breed *</label>
              <input type="text" id="breed" name="breed" value={formData.breed} onChange={handleChange} onInput={handleChange} required placeholder="Enter breed" />
            </div>
            <div className="form-group">
              <label htmlFor="age">Age (years) *</label>
              <input type="number" id="age" name="age" value={formData.age} onChange={handleChange} onInput={handleChange} required min="0" max="20" placeholder="Enter age in years" />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender *</label>
              <select id="gender" name="gender" value={formData.gender} onChange={handleChange} onInput={handleChange} required>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleChange} onInput={handleChange} required rows="4" placeholder="Describe the pet's personality, health, and special needs" />
            </div>
            <div className="form-group">
              <label htmlFor="listingType">Listing Type *</label>
              <select id="listingType" name="listingType" value={formData.listingType} onChange={handleChange} onInput={handleChange} required>
                <option value="adoption">Adoption</option>
                <option value="sale">Sale</option>
              </select>
            </div>
            {formData.listingType === 'sale' && (
              <div className="form-group">
                <label htmlFor="price">Price (₹) *</label>
                <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} onInput={handleChange} required={formData.listingType === 'sale'} min="1" placeholder="Enter price in rupees" />
              </div>
            )}
            {/* Location inputs */}
            <div className="form-group">
              <label>Location (required)</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Latitude"
                  value={latitude}
                  required
                  onChange={handleLatitudeChange}
                  onInput={handleLatitudeChange}
                  style={{ flex: '1 1 140px' }}
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={longitude}
                  required
                  onChange={handleLongitudeChange}
                  onInput={handleLongitudeChange}
                  style={{ flex: '1 1 140px' }}
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={geoLoading}
                  style={{ padding: '6px 10px', background: '#667eea', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {geoLoading ? 'Locating...' : 'Use My Location'}
                </button>
              </div>
              {geoError && <small style={{ color: 'red' }}>{geoError}</small>}
              <small className="form-note">Latitude and longitude are now required to show the pet location on the map.</small>
            </div>
            <div className="form-group">
              <label htmlFor="image">Pet Image *</label>
              <input type="file" id="image" name="image" onChange={handleImageChange} accept="image/jpeg,image/jpg,image/png,image/gif" required />
              <small className="form-note">Please select an image file (JPEG, PNG, or GIF). Max size: 5MB</small>
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Pet preview" style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px', border: '2px solid #e0e0e0' }} />
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" onClick={handleCancel} className="cancel-btn" style={{ marginRight: '10px', background: '#ccc', color: '#333' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Sending Request...' : 'Send Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddPetRequest;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import axios from 'axios';
import AdminNavbar from './AdminNavbar';
import ImageModal from '../components/ImageModal';
import './ViewPets.css';

function AdoptedPets() {
	const { isAuthenticated, isAdmin } = useAuth();
	const navigate = useNavigate();
	const [pets, setPets] = useState([]);
	const [loading, setLoading] = useState(true);
	const [, setError] = useState('');
	const [modalImage, setModalImage] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		if (!isAuthenticated || !isAdmin) {
			navigate('/admin-login');
		}
	}, [isAuthenticated, isAdmin, navigate]);

	useEffect(() => {
		fetchPets();
	}, []);

	const fetchPets = async () => {
		try {
			const response = await axios.get('http://localhost:5000/api/pets');
			// Include both adopted and sold for this consolidated view
			setPets(response.data.filter(pet => pet.status === 'adopted' || pet.status === 'sold'));
		} catch (error) {
			setError('Failed to fetch pets');
		} finally {
			setLoading(false);
		}
	};

	const handleImageClick = (pet) => {
		setModalImage({ url: pet.image, alt: `${pet.name} - ${pet.breed}` });
		setIsModalOpen(true);
	};
	const closeModal = () => {
		setIsModalOpen(false);
		setModalImage(null);
	};

	if (!isAuthenticated || !isAdmin) {
		return (
			<div className="view-pets-container">
				<AdminNavbar />
				<div className="loading">Not authorized or not logged in as admin.</div>
			</div>
		);
	}
	if (loading) return <div className="view-pets-container"><AdminNavbar /><div className="loading">Loading pets...</div></div>;

	return (
		<div className="view-pets-container">
			<AdminNavbar />
			<div className="view-pets-content">
				<h2>Adopted / Sold Pets</h2>
				<div className="pets-grid">
					{pets.length === 0 ? (
						<div className="no-pets">No adopted or sold pets</div>
					) : (
						pets.map((pet) => (
							<div key={pet._id} className="pet-card adopted">
								<div className="pet-image">
									<img src={pet.image} alt={pet.name} onClick={() => handleImageClick(pet)} style={{ cursor: 'pointer' }} />
									<div className={`pet-status ${pet.status}`}>{pet.status === 'sold' ? 'Sold' : 'Adopted'}</div>
								</div>
								<div className="pet-info">
									<h3>{pet.name}</h3>
									<p className="pet-breed">{pet.breed}</p>
									<p className="pet-type">{pet.type} • {pet.age} years old</p>
									{pet.listingType === 'sale' && pet.price && (
										<p className="pet-price"><strong>{pet.status === 'sold' ? 'Sold for' : 'Listed Price'}: ₹{pet.price}</strong></p>
									)}
									<p className="pet-description">{pet.description}</p>
									{pet.adoptedBy && pet.adoptedBy.name && (
										<div className="adopted-info">
											<p><strong>{pet.status === 'sold' ? 'Purchased by:' : 'Adopted by:'}</strong> {pet.adoptedBy.name}</p>
											<p><strong>{pet.status === 'sold' ? 'Sold on:' : 'Adopted on:'}</strong> {pet.updatedAt ? new Date(pet.updatedAt).toLocaleString() : 'N/A'}</p>
										</div>
									)}
								</div>
							</div>
						))
					)}
				</div>
			</div>
			<ImageModal isOpen={isModalOpen} imageUrl={modalImage?.url} altText={modalImage?.alt} onClose={closeModal} />
		</div>
	);
}

export default AdoptedPets;

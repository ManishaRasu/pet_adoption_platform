import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import MapAllPets from './MapAllPets';

function Home() {


  return (
    <div className="home-container">
      <div className="hero">
        <h1>Welcome to <span className="brand-highlight">TailMate</span></h1>
        <p className="hero-desc">
          Discover your new best friend! <br />
          Adopt a loving pet and give them a forever home.
        </p>
        <Link to="/pets" className="adopt-pet-btn">Adopt Pet</Link>
      </div>
      {/* Map showing all pet locations */}
      <section style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <h2 style={{ marginBottom: 12 }}>Pets Nearby</h2>
        <MapAllPets />
      </section>
      <section className="home-info">
        <h2>Why Adopt from TailMate?</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">🐾</div>
            <h3>Save a Life</h3>
            <p>Every adoption saves a life and makes room for another pet in need. Be a hero in a pet's story.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">🏡</div>
            <h3>Perfect Companion</h3>
            <p>Find the ideal furry friend that matches your lifestyle and brings endless joy to your family.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">💖</div>
            <h3>Responsible Adoption</h3>
            <p>Support ethical pet adoption practices and help build a more compassionate community.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>🐾 TailMate</h3>
            <p>Connecting loving families with pets in need of forever homes. Making adoption easier, one tail wag at a time.</p>
            <div className="social-links">
              <button type="button" aria-label="Facebook" onClick={() => window.open('https://facebook.com', '_blank')}>📘</button>
              <button type="button" aria-label="Twitter" onClick={() => window.open('https://twitter.com', '_blank')}>🐦</button>
              <button type="button" aria-label="Instagram" onClick={() => window.open('https://instagram.com', '_blank')}>📷</button>
              <button type="button" aria-label="YouTube" onClick={() => window.open('https://youtube.com', '_blank')}>📺</button>
            </div>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/pets">🔍 Browse Pets</Link></li>
              <li><Link to="/signup">💝 Adopt Now</Link></li>
              <li><Link to="/about">ℹ️ About Us</Link></li>
              <li><button type="button" onClick={() => window.location.hash = 'contact'}>📩 Contact</button></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Pet Categories</h4>
            <ul>
              <li><Link to="/pets?type=Dog">🐕 Dogs</Link></li>
              <li><Link to="/pets?type=Cat">🐈 Cats</Link></li>
              <li><Link to="/pets?type=Bird">🐦 Birds</Link></li>
              <li><Link to="/pets?type=Rabbit">🐇 Rabbits</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><button type="button" onClick={() => window.location.hash = 'help'}>❓ Help Center</button></li>
              <li><button type="button" onClick={() => window.location.hash = 'adoption-guide'}>📋 Adoption Guide</button></li>
              <li><button type="button" onClick={() => window.location.hash = 'care-tips'}>💡 Pet Care Tips</button></li>
              <li><button type="button" onClick={() => window.location.hash = 'volunteer'}>🤝 Volunteer</button></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact Us</h4>
            <div className="contact-info">
              <p>📞 (555) 123-PETS</p>
              <p>📧 adopt@tailmate.com</p>
              <p>📍 123 Pet Street, Animal City</p>
              <p>🕒 Mon-Sat: 9AM-6PM</p>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 TailMate. All rights reserved. | <button type="button" onClick={() => window.location.hash = 'privacy'}>Privacy Policy</button> | <button type="button" onClick={() => window.location.hash = 'terms'}>Terms of Service</button></p>
        </div>
      </footer>
    </div>
  );
}

export default Home;

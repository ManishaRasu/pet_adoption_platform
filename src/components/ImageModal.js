import React from 'react';
import './ImageModal.css';

function ImageModal({ isOpen, imageUrl, altText, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };



  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="image-modal-overlay" onClick={handleOverlayClick}>
      <div className="image-modal-content">
        <button className="image-modal-close" onClick={onClose}>
          ✕
        </button>
        <img 
          src={imageUrl} 
          alt={altText} 
          className="image-modal-img"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="image-modal-caption">
          {altText}
        </div>
      </div>
    </div>
  );
}

export default ImageModal;

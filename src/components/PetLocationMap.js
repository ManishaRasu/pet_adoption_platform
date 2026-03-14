import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useParams } from 'react-router-dom';

// Fix default icon paths for Leaflet when bundling
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Configure default marker icon (CRA asset handling)
L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function PetLocationMap({ lat, lng, petName, height = 300 }) {

  const params = useParams?.();

  useEffect(() => {
    if (lat == null || lng == null) return;
    const map = L.map('pet-location-map', { attributionControl: true }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (petName) {
      const safeName = String(petName);
      const shortName = safeName.length > 18 ? safeName.slice(0, 15) + '…' : safeName;
      const html = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-8px);">
          <div style="background:#2563eb;color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.35);white-space:nowrap;">${shortName}</div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #2563eb;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));margin-top:2px;"></div>
          <div style="margin-top:2px;"> <img src="${iconUrl}" alt="" style="width:25px;height:41px;display:block;" /> </div>
        </div>`;
      const customIcon = L.divIcon({ html, className: 'pet-name-marker', iconSize: [30, 55], iconAnchor: [15, 55] });
      L.marker([lat, lng], { icon: customIcon }).addTo(map);
    } else {
      L.marker([lat, lng]).addTo(map);
    }

    return () => map.remove();
  }, [lat, lng, petName]);

  if (lat == null || lng == null) return null;
  return (
    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={(e) => {
      e.preventDefault();
      if (params?.id) {
        const url = window.location.origin + `/pets/${params.id}/map`;
        window.open(url, '_blank', 'noopener');
      }
    }}>
      <div id="pet-location-map" style={{ width: '100%', height, borderRadius: 8, marginTop: 16 }} />
      <div style={{ position: 'absolute', top: 8, right: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>Open Full Map</div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from './AuthContext';
// Routing machine dynamically imported later to avoid build error if dependency missing.

// Ensure default icons work in bundler
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function FullMapPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isAdmin } = useAuth();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const petMarkerRef = useRef(null);
    const userMarkerRef = useRef(null);
    const lastRouteUpdateRef = useRef(0);
    const lineRef = useRef(null);
    const watchIdRef = useRef(null);
    const [pet, setPet] = useState(null);
    const [error, setError] = useState('');
    const [distance, setDistance] = useState(null);
    const routingControlRef = useRef(null);
    const routingInitInProgressRef = useRef(false); // guard against double creation
    // Removed search functionality per request
    const [isRoutingActive] = useState(true); // auto start road routing
    const [routeSummary, setRouteSummary] = useState(null); // {distance, time}
    const [routingError, setRoutingError] = useState(null);
    const [routingLibLoaded, setRoutingLibLoaded] = useState(false);
    const [routingLoading, setRoutingLoading] = useState(false);
    const [locationStatus, setLocationStatus] = useState('acquiring'); // acquiring | active | error
    const userLocationInitializedRef = useRef(false);

    useEffect(() => {
        const fetchPet = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/pets/${id}`);
                setPet(res.data);
            } catch (e) {
                setError('Failed to load pet');
            }
        };
        fetchPet();
    }, [id]);

    // Haversine distance in km
    const computeDistanceKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Initialize map when pet & location present
    useEffect(() => {
        if (!pet || !pet.location || pet.location.lat == null || pet.location.lng == null) return;
        if (mapInstance.current) return; // already inited

        mapInstance.current = L.map(mapRef.current, { attributionControl: true }).setView([pet.location.lat, pet.location.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance.current);

        // Custom popup HTML similar to screenshot style
        const popupHtml = `
    <div style="font-family:system-ui,Arial,sans-serif;min-width:250px;max-width:300px;">
      <h4 style="margin:0 0 4px;font-size:15px;">${pet.name || 'Pet'}</h4>
      <div style="font-size:12px;color:#374151;margin-bottom:6px;">${pet?.description ? (pet.description.substring(0, 90) + (pet.description.length > 90 ? '...' : '')) : 'Pet location'}</div>
            <div style="margin-top:8px;">
                <button data-adopt-btn style="background:#2563eb;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;">${'Adopt / Buy'}</button>
            </div>
    </div>`;
        petMarkerRef.current = L.marker([pet.location.lat, pet.location.lng]).addTo(mapInstance.current).bindPopup(popupHtml, { maxWidth: 320 }).openPopup();

        // Helper to initialize / update user position
        const handlePosition = async (pos) => {
            const { latitude, longitude } = pos.coords;
            if (!userMarkerRef.current) {
                const pulseHtml = `<div style="position:relative;width:18px;height:18px;">
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(37,99,235,0.8);"></div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;animation:pulse 1.6s linear infinite;border:3px solid rgba(37,99,235,0.5);"></div>
</div>`;
                const pulseIcon = L.divIcon({ html: pulseHtml, className: 'live-loc-icon', iconSize: [18, 18] });
                userMarkerRef.current = L.marker([latitude, longitude], { icon: pulseIcon }).addTo(mapInstance.current).bindPopup('Your live location');
            } else {
                userMarkerRef.current.setLatLng([latitude, longitude]);
            }

            // Center map once when we first get a valid user location (improves user understanding of route start)
            if (!userLocationInitializedRef.current) {
                mapInstance.current.setView([latitude, longitude], 16);
                userLocationInitializedRef.current = true;
            }

            setLocationStatus('active');

            // Distance & polyline
            const dKm = computeDistanceKm(latitude, longitude, pet.location.lat, pet.location.lng);
            setDistance(dKm);
            // Maintain fallback straight line only if routing inactive or errored
            if (!isRoutingActive || routingError) {
                if (lineRef.current) {
                    lineRef.current.setLatLngs([[latitude, longitude], [pet.location.lat, pet.location.lng]]);
                } else {
                    lineRef.current = L.polyline([[latitude, longitude], [pet.location.lat, pet.location.lng]], { color: '#2563eb', weight: 3, dashArray: '4 6' }).addTo(mapInstance.current);
                }
            } else if (lineRef.current) {
                // Remove fallback line when proper routing active
                mapInstance.current.removeLayer(lineRef.current);
                lineRef.current = null;
            }

            // Ensure routing control present if active
            if (!routingControlRef.current && isRoutingActive && !routingInitInProgressRef.current) {
                try {
                    routingInitInProgressRef.current = true;
                    setRoutingLoading(true);
                    if (!routingLibLoaded) {
                        await Promise.all([
                            import('leaflet-routing-machine')
                        ]).catch(err => { throw err });
                        // Inject CSS if not already
                        if (!document.querySelector('link[data-lrm]')) {
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.href = 'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css';
                            link.setAttribute('data-lrm', 'true');
                            document.head.appendChild(link);
                        }
                        setRoutingLibLoaded(true);
                    }
                    if (window.L && window.L.Routing) {
                        routingControlRef.current = L.Routing.control({
                            waypoints: [L.latLng(latitude, longitude), L.latLng(pet.location.lat, pet.location.lng)],
                            lineOptions: { styles: [{ color: '#1d4ed8', weight: 6, opacity: 0.85 }] },
                            addWaypoints: false,
                            draggableWaypoints: false,
                            fitSelectedRoutes: true,
                            show: true,
                            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' })
                        }).addTo(mapInstance.current);
                        routingControlRef.current.on('routesfound', (e) => {
                            if (e.routes && e.routes[0]) {
                                const r = e.routes[0].summary;
                                setRouteSummary({ distance: r.totalDistance, time: r.totalTime });
                                setRoutingError(null);
                                setRoutingLoading(false);
                                // Deduplicate any stray duplicated panels
                                try {
                                    const panels = document.querySelectorAll('.leaflet-routing-container');
                                    if (panels.length > 1) {
                                        // Keep the last (most recent) panel; remove earlier ones
                                        panels.forEach((p, idx) => { if (idx < panels.length - 1) p.remove(); });
                                    }
                                } catch (e2) { /* ignore */ }
                            }
                            routingInitInProgressRef.current = false;
                        });
                        routingControlRef.current.on('routingerror', (e) => {
                            console.warn('Routing error', e);
                            setRoutingError('Route not available');
                            setRoutingLoading(false);
                            routingInitInProgressRef.current = false;
                        });
                        // Force immediate first route update timestamp
                        lastRouteUpdateRef.current = Date.now();
                    }
                } catch (e) {
                    console.warn('Routing init failure', e);
                    setRoutingError('Routing failed to initialize');
                    setRoutingLoading(false);
                    routingInitInProgressRef.current = false;
                }
            } else if (routingControlRef.current && isRoutingActive) {
                // Update route dynamically if possible (force first update if ref == 0)
                try {
                    const now = Date.now();
                    const moved = userMarkerRef.current ? userMarkerRef.current.getLatLng().distanceTo(L.latLng(latitude, longitude)) : 9999;
                    if (lastRouteUpdateRef.current === 0 || now - lastRouteUpdateRef.current > 5000 || moved > 10) {
                        routingControlRef.current.setWaypoints([
                            L.latLng(latitude, longitude),
                            L.latLng(pet.location.lat, pet.location.lng)
                        ]);
                        lastRouteUpdateRef.current = now;
                    }
                } catch (e) {
                    // ignore
                }
            }
        };

        // Attempt to watch user location
        if (navigator.geolocation) {
            // First, try an immediate current position to accelerate routing start
            navigator.geolocation.getCurrentPosition(pos => {
                handlePosition(pos);
            }, err => {
                console.warn('Initial geolocation error:', err.message);
                setLocationStatus('error');
            }, { enableHighAccuracy: true, timeout: 8000 });

            watchIdRef.current = navigator.geolocation.watchPosition(async pos => {
                handlePosition(pos);
            }, err => {
                console.warn('Geolocation error:', err.message);
                if (!userLocationInitializedRef.current) {
                    setLocationStatus('error');
                }
            }, { enableHighAccuracy: true, maximumAge: 5000 });
        }

        return () => {
            if (watchIdRef.current && navigator.geolocation.clearWatch) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pet]);

    // Event delegation for popup buttons after open
    useEffect(() => {
        if (!mapInstance.current) return;
        const attachHandlers = (container) => {
            if (!container) return;
            const adoptBtn = container.querySelector('button[data-adopt-btn]');
            if (adoptBtn) {
                adoptBtn.onclick = () => {
                    // Client-side navigation to preserve auth context (avoid full reload race)
                    if (!isAuthenticated || isAdmin) {
                        navigate('/user-login');
                    } else {
                        navigate(`/pets/${id}/request`);
                    }
                };
            }
        };

        mapInstance.current.on('popupopen', (e) => {
            attachHandlers(e.popup.getElement());
        });

        // If already open right after creation
        if (petMarkerRef.current) {
            const p = petMarkerRef.current.getPopup();
            if (p && p.isOpen()) attachHandlers(p.getElement());
        }

        return () => {
            // Defensive: map might have been removed by earlier cleanup (geo watch effect) before this effect unmounts
            if (mapInstance.current) {
                mapInstance.current.off('popupopen');
            }
        };
    }, [pet, id, isAuthenticated, isAdmin, navigate]);

    // Keep popup navigate button state in sync if it remains open while state changes
    // Removed navigate button state sync effect (buttons removed)

    // (Search removed)

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* Search bar removed */}
            {routingLoading && (
                <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, background: 'rgba(31,41,55,0.85)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
                    Preparing route...
                </div>
            )}
            {locationStatus === 'acquiring' && !error && (
                <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 10000, background: 'rgba(55,65,81,0.9)', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                    Getting your location...
                </div>
            )}
            {locationStatus === 'error' && !error && (
                <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 10000, background: '#b91c1c', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                    Location unavailable. Enable GPS/permissions.
                </div>
            )}
            {userLocationInitializedRef.current && (
                <button onClick={() => {
                    if (userMarkerRef.current) {
                        const { lat, lng } = userMarkerRef.current.getLatLng();
                        mapInstance.current.setView([lat, lng]);
                    }
                }} style={{ position: 'absolute', top: 10, right: 10, zIndex: 10000, background: '#1f2937', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
                    Recenter
                </button>
            )}
            {error && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9999, background: '#dc2626', color: '#fff', padding: '6px 10px', borderRadius: 4 }}>{error}</div>}
            {distance != null && !error && (
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9998, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '8px 12px', borderRadius: 6, fontSize: 13, lineHeight: 1.35 }}>
                    <strong>{pet ? pet.name : 'Pet'}</strong><br />
                    Straight: {(distance < 1 ? (distance * 1000).toFixed(0) + ' m' : distance.toFixed(2) + ' km')}
                    {routeSummary && (
                        <> | Road: {(routeSummary.distance / 1000).toFixed(2)} km ({Math.round(routeSummary.time / 60)} min)</>
                    )}
                    {routingError && (
                        <div style={{ marginTop: 4, color: '#f87171' }}>Routing error: {routingError}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}><span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: '50%', display: 'inline-block', marginRight: 4 }}></span>You</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ width: 10, height: 10, background: '#1d4ed8', borderRadius: '2px', display: 'inline-block', marginRight: 4 }}></span>Destination</span>
                    </div>
                </div>
            )}
            {!pet?.location && !error && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9999, background: '#374151', color: '#fff', padding: '6px 10px', borderRadius: 4 }}>No location for this pet.</div>}
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}

// Removed external navigation buttons per user request.

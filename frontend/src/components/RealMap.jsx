import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Real GPS-anchored map using Leaflet + OpenStreetMap tiles.
 *
 * Tile provider: CartoDB Dark Matter (free, no API key, matches our dark theme).
 * Attribution is legally required for OSM — rendered in bottom-right at small size.
 *
 * Props:
 *   - location: { lat, lon } user position (centers the map)
 *   - contacts: array of { id, name, category, lat, lon, distance, phone }
 *   - gpsLost: dim user dot if GPS is stale
 *   - interactive: allow user to pan/zoom (default false — hero section is static)
 */

// Tone palette matches MapHero
const TONES = {
  red: '#EF4444',
  blue: '#3B82F6',
  teal: '#14B8A6',
};

const CAT_TONES = {
  hospital: 'red',
  ambulance: 'red',
  police: 'blue',
  fire: 'red',
  towing: 'teal',
  repair: 'teal',
  showroom: 'teal',
  tyre: 'teal',
};

const CAT_EMOJI = {
  hospital: '🏥',
  ambulance: '🚑',
  police: '🛡️',
  fire: '🔥',
  towing: '🚛',
  repair: '🔧',
  showroom: '🚗',
  tyre: '🛞',
};

/** Custom user-location divIcon — pulsing green dot with halo. */
function buildUserIcon(gpsLost) {
  const color = gpsLost ? '#94A3B8' : '#22C55E';
  return L.divIcon({
    className: 'rs-user-marker',
    html: `
      <div class="rs-user-halo" style="background: radial-gradient(circle, ${color}55 0%, transparent 70%);"></div>
      <div class="rs-user-pulse" style="background: ${color};"></div>
      <div class="rs-user-dot" style="background: ${color}; box-shadow: 0 4px 12px ${color}aa;"></div>
    `,
    iconSize: [110, 110],
    iconAnchor: [55, 55],
  });
}

/** Custom service-pin divIcon — colored circle + emoji + name+km chip above. */
function buildServiceIcon(contact) {
  const cat = (contact.category || 'repair').toLowerCase();
  const tone = CAT_TONES[cat] || 'teal';
  const color = TONES[tone];
  const emoji = CAT_EMOJI[cat] || '📍';
  const shortName = (contact.name || '').split(/[,·\-]/)[0].trim().substring(0, 16);
  const km = typeof contact.distance === 'number' ? contact.distance.toFixed(1) : '?';

  return L.divIcon({
    className: 'rs-service-marker',
    html: `
      <div class="rs-svc-chip">
        <span class="rs-svc-name">${shortName}</span>
        <span class="rs-svc-km">${km}km</span>
      </div>
      <div class="rs-svc-pin" style="background: ${color}; box-shadow: 0 4px 14px ${color}aa;">
        <span>${emoji}</span>
      </div>
      <div class="rs-svc-point"></div>
    `,
    iconSize: [60, 80],
    iconAnchor: [30, 80],
  });
}

/** Re-centers map when location prop changes (e.g., user moves or demo location switches). */
function MapRecenter({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lon != null) {
      map.setView([lat, lon], zoom, { animate: true, duration: 0.6 });
    }
  }, [lat, lon, zoom, map]);
  return null;
}

export default function RealMap({
  location,
  contacts = [],
  gpsLost = false,
  interactive = false,
  zoom = 15,
}) {
  const mapRef = useRef(null);

  // Default fallback (India centroid) until GPS arrives — better than a blank screen.
  const lat = location?.lat ?? 20.5937;
  const lon = location?.lon ?? 78.9629;
  const hasGps = location?.lat != null && location?.lon != null;

  const userIcon = useMemo(() => buildUserIcon(gpsLost), [gpsLost]);
  const serviceMarkers = useMemo(
    () =>
      contacts
        .filter((c) => typeof c.lat === 'number' && typeof c.lon === 'number')
        .slice(0, 6),
    [contacts],
  );

  return (
    <div className="rs-real-map">
      <MapContainer
        ref={mapRef}
        center={[lat, lon]}
        zoom={hasGps ? zoom : 4}
        zoomControl={interactive}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        attributionControl={true}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <MapRecenter lat={lat} lon={lon} zoom={hasGps ? zoom : 4} />

        {hasGps && (
          <Marker position={[lat, lon]} icon={userIcon} interactive={false} />
        )}

        {serviceMarkers.map((c) => (
          <Marker
            key={c.id || `${c.lat},${c.lon}`}
            position={[c.lat, c.lon]}
            icon={buildServiceIcon(c)}
            interactive={false}
          />
        ))}
      </MapContainer>
    </div>
  );
}

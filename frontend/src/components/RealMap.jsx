import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import indiaBoundary from '../data/india-boundary.json';

/**
 * Real GPS-anchored map using Leaflet + OpenStreetMap tiles.
 *
 * Tile provider: CartoDB Dark Matter (free, no API key, matches our dark
 * theme). The tiles cover the entire globe — every country, every ocean.
 * Attribution is legally required for OSM — rendered in bottom-right at
 * small size.
 *
 * Indian boundary overlay:
 *   When the user's country code resolves to 'IN', a saffron polygon is
 *   drawn over the OSM tiles tracing the Government-of-India official
 *   boundary: full Jammu & Kashmir (Gilgit-Baltistan + PoK), Aksai Chin,
 *   Ladakh, and Arunachal Pradesh per India's territorial claim. OSM
 *   tiles alone show the de-facto Line of Actual Control, not the
 *   Indian claim — this overlay corrects that for users in India while
 *   leaving the global tile coverage untouched.
 *
 * Props:
 *   - location: { lat, lon } user position (centers the map)
 *   - contacts: array of { id, name, category, lat, lon, distance, phone }
 *   - countryCode: ISO-3166 alpha-2 from reverse geocode (drives Indian
 *     boundary overlay)
 *   - gpsLost: dim user dot if GPS is stale
 *   - draggable: pan/pinch enabled (default true)
 *   - zoom: initial zoom level (default 15 = neighbourhood)
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

// Saffron stroke (top band of the Indian flag) for the official boundary.
// Tasteful low fill so it doesn't dominate the map, just makes the claim
// visible at all relevant zoom levels.
const INDIA_BOUNDARY_STYLE = {
  color: '#FF9933',
  weight: 2.2,
  opacity: 0.9,
  fillColor: '#FF9933',
  fillOpacity: 0.04,
  dashArray: '0',
  interactive: false,
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

/** Tile-load listener — flips off the loading shimmer when the first
 *  batch of CartoDB tiles has actually rendered. */
function TileLoadSignal({ onLoad }) {
  const map = useMap();
  useEffect(() => {
    // Wait for the next tile-layer's `load` event (fires after all visible
    // tiles in the current view have downloaded).
    const handler = (e) => {
      if (e.layer && typeof e.layer.on === 'function') {
        e.layer.once('load', () => onLoad?.());
      }
    };
    map.on('layeradd', handler);
    return () => map.off('layeradd', handler);
  }, [map, onLoad]);
  return null;
}

export default function RealMap({
  location,
  contacts = [],
  countryCode = null,
  gpsLost = false,
  draggable = true,
  zoom = 15,
}) {
  const mapRef = useRef(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);

  // Default fallback (India centroid) until GPS arrives — better than a blank screen.
  const lat = location?.lat ?? 20.5937;
  const lon = location?.lon ?? 78.9629;
  const hasGps = location?.lat != null && location?.lon != null;
  const isIndia = (countryCode || '').toUpperCase() === 'IN';

  const userIcon = useMemo(() => buildUserIcon(gpsLost), [gpsLost]);
  const serviceMarkers = useMemo(
    () =>
      contacts
        .filter((c) => typeof c.lat === 'number' && typeof c.lon === 'number')
        .slice(0, 6),
    [contacts],
  );

  return (
    <div className={`rs-real-map ${tilesLoaded ? 'is-loaded' : 'is-loading'}`}>
      {/* Loading shimmer — fades out once tiles render */}
      {!tilesLoaded && (
        <div className="rs-map-skeleton" aria-hidden="true">
          <div className="rs-map-skeleton-shimmer" />
          <div className="rs-map-skeleton-label">Loading map…</div>
        </div>
      )}

      <MapContainer
        ref={mapRef}
        center={[lat, lon]}
        zoom={hasGps ? zoom : 4}
        zoomControl={false}
        scrollWheelZoom={draggable}
        dragging={draggable}
        doubleClickZoom={draggable}
        touchZoom={draggable}
        boxZoom={draggable}
        keyboard={draggable}
        attributionControl={true}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
          eventHandlers={{ load: () => setTilesLoaded(true) }}
        />

        <TileLoadSignal onLoad={() => setTilesLoaded(true)} />

        {/* Zoom control on the right edge — far from the brand cross
            (top-left) and the SOS dock (bottom). */}
        {draggable && <ZoomControl position="topright" />}

        {/* Government of India official boundary, drawn on top of OSM tiles
            when the user is in India. Includes full J&K, Aksai Chin, Ladakh,
            Arunachal Pradesh — Survey of India compliant outline. */}
        {isIndia && (
          <GeoJSON
            key="india-boundary"
            data={indiaBoundary}
            style={() => INDIA_BOUNDARY_STYLE}
          />
        )}

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

import React from 'react';
import { guardedTelDial } from '../utils/demoMode';

const CATEGORY_LABELS = {
  hospital:  '🏥 Hospital',
  police:    '👮 Police',
  ambulance: '🚑 Ambulance',
  towing:    '🚛 Towing',
  repair:    '🔧 Repair',
  tyre:      '🛞 Tyre',
  showroom:  '🚗 Showroom',
};

const CATEGORY_ICONS = {
  hospital:  '🏥',
  police:    '👮',
  ambulance: '🚑',
  towing:    '🚛',
  repair:    '🔧',
  tyre:      '🛞',
  showroom:  '🚗',
};

export default function ContactCard({ contact, isTop }) {
  const { name, category, distance, phone, source, isOpen, aiReason, lat, lon } = contact;

  // Normalise phone: strip spaces for the href, keep formatted for display
  const phoneClean = phone ? phone.replace(/\s+/g, '') : null;
  const callHref   = phoneClean ? `tel:${phoneClean}` : null;

  // Google Maps directions URL — uses the "dir" endpoint so Maps prompts
  // the user's current location as the origin and the contact as the
  // destination. The query name is included so the pin shows the place
  // name even when the lat/lon resolves to a slightly different polygon.
  const mapsHref = (typeof lat === 'number' && typeof lon === 'number')
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodeURIComponent(name || '')}`
    : null;

  const cat = (category || 'repair').toLowerCase();

  return (
    <div className={`contact-card ${isTop ? 'contact-card--top' : ''}`}>
      {/* AI Priority banner — only on top card */}
      {aiReason && (
        <div className="contact-card__ai-reason">
          <span className="ai-icon">⚡</span>
          <span>
            <strong>AI Priority:</strong> {aiReason}
          </span>
        </div>
      )}

      {/* Header row: badge + open/closed status */}
      <div className="contact-card__header">
        <span className={`category-badge category-badge--${cat}`}>
          {CATEGORY_LABELS[cat] || category}
        </span>
        <span className="contact-card__status">
          {isOpen === true  && <span className="status status--open">● Open</span>}
          {isOpen === false && <span className="status status--closed">● Closed</span>}
        </span>
      </div>

      {/* Name */}
      <h3 className="contact-card__name">{name}</h3>

      {/* Distance + source */}
      <div className="contact-card__meta">
        <span className="contact-card__distance">
          📍 {typeof distance === 'number' ? `${distance.toFixed(1)} km away` : 'Distance unknown'}
        </span>
        {phone && (
          <span className="contact-card__phone">{phone}</span>
        )}
      </div>

      {/* Big call button */}
      {callHref ? (
        <a
          href={callHref}
          className="call-button"
          id={`call-btn-${phoneClean}`}
          role="button"
          aria-label={`Call ${name} at ${phone}`}
          onClick={(e) => guardedTelDial(e, phoneClean, name)}
        >
          <span aria-hidden="true">📞</span> Call {phone}
        </a>
      ) : (
        <div className="call-button call-button--disabled">
          No phone number listed
        </div>
      )}

      {/* Open in Google Maps — directions from current location */}
      {mapsHref && (
        <a
          href={mapsHref}
          className="maps-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open directions to ${name} in Google Maps`}
        >
          <span aria-hidden="true">🧭</span> Open Google Maps for directions
        </a>
      )}

      {/* Data provenance */}
      <div className="contact-card__source">
        via {source || 'Unknown source'}
      </div>
    </div>
  );
}

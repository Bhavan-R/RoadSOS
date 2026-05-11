import React from 'react';

const CATEGORY_LABELS = {
  hospital: 'Hospital',
  police: 'Police',
  ambulance: 'Ambulance',
  towing: 'Towing',
  repair: 'Repair',
  tyre: 'Tyre',
};

export default function ContactCard({ contact, isTop }) {
  const { name, category, distance, phone, source, isOpen, aiReason } = contact;
  const callHref = phone ? `tel:${phone.replace(/\s+/g, '')}` : null;

  return (
    <div className={`contact-card ${isTop ? 'contact-card--top' : ''}`}>
      {aiReason && (
        <div className="contact-card__ai-reason">
          <span className="ai-icon">⚡</span>
          <span><strong>AI Priority:</strong> {aiReason}</span>
        </div>
      )}

      <div className="contact-card__header">
        <span className={`category-badge category-badge--${category}`}>
          {CATEGORY_LABELS[category] || category}
        </span>
        {isOpen === true && <span className="status status--open">● Open</span>}
        {isOpen === false && <span className="status status--closed">● Closed</span>}
      </div>

      <h3 className="contact-card__name">{name}</h3>

      <div className="contact-card__meta">
        <span className="distance">{distance} km away</span>
        <span className="source">via {source}</span>
      </div>

      {callHref ? (
        <a href={callHref} className="call-button">
          <span aria-hidden="true">📞</span> Call {phone}
        </a>
      ) : (
        <div className="call-button call-button--disabled">No phone number listed</div>
      )}
    </div>
  );
}

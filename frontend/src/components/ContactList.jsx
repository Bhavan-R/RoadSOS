import React from 'react';
import ContactCard from './ContactCard';

export default function ContactList({ contacts, loading, error, cachedAt }) {
  if (loading) {
    return (
      <div className="contact-list contact-list--loading">
        <div className="spinner" />
        <p>Finding nearby help...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contact-list contact-list--error">
        <p><strong>Error:</strong> {error}</p>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="contact-list contact-list--empty">
        <p>No services found nearby. Use the national emergency number above.</p>
      </div>
    );
  }

  return (
    <div className="contact-list">
      {cachedAt && (
        <div className="cached-note">
          Showing cached results from {cachedAt}
        </div>
      )}
      {contacts.map((c, idx) => (
        <ContactCard key={c.id || idx} contact={c} isTop={idx === 0} />
      ))}
    </div>
  );
}

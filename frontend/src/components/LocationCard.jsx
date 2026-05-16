import React from 'react';

export default function LocationCard({ landmark, loading, source, countryName }) {
  const address = landmark || 'Detecting location…';
  const meta = loading
    ? 'Searching…'
    : source === 'demo'
    ? 'Demo'
    : source === 'ip'
    ? 'Approx IP'
    : 'GPS';

  return (
    <div className="loc-bar">
      <div className="loc-pulse" />
      <span className="loc-text">
        {meta} · {address}
      </span>
      <span className="loc-country">{countryName || 'India'}</span>
    </div>
  );
}

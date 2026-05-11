import React from 'react';

export default function OfflineBanner({ isOnline }) {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="status">
      <strong>⚠ You are offline.</strong> Showing last saved results. National emergency numbers always available.
    </div>
  );
}

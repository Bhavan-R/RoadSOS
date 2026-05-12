import React from 'react';
import { useNetwork } from '../hooks/useNetwork';

/**
 * OfflineBanner — yellow strip shown when navigator.onLine is false.
 * Disappears automatically when connectivity returns.
 * Uses the useNetwork hook internally — no props needed from parent.
 */
export default function OfflineBanner() {
  const isOnline = useNetwork();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__icon">⚡</span>
      <span className="offline-banner__text">
        <strong>You are offline.</strong>{' '}
        Showing last saved results. National emergency numbers always available.
      </span>
    </div>
  );
}

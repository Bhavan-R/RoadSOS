import React, { useEffect, useState } from 'react';
import { Check, Ambulance, Navigation2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * DispatchScreen — full-screen "Help is on the way" overlay.
 * Shown after SOS dispatched. Mirrors the FinalDispatch (Glass) design.
 */
export default function DispatchScreen({ open, onClose, location, landmark, contacts = [], topContact, dispatchedAt, isCrash = false, triageReason = null }) {
  const [elapsed, setElapsed] = useState(0);
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language.startsWith('en');

  useEffect(() => {
    if (!open) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const minutes = String(Math.floor((6 * 60 - elapsed) / 60)).padStart(2, '0');
  const eta = Math.max(0, 6 - Math.floor(elapsed / 60));
  const stamp = new Date(dispatchedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const hospitalContact = contacts.find(c => (c.category || '').toLowerCase() === 'hospital') || topContact;
  const formatCoords = (loc) => {
    if (!loc?.lat || !loc?.lon) return '— — —';
    const ns = loc.lat >= 0 ? 'N' : 'S';
    const ew = loc.lon >= 0 ? 'E' : 'W';
    return `${Math.abs(loc.lat).toFixed(4)}°${ns}, ${Math.abs(loc.lon).toFixed(4)}°${ew}`;
  };

  const BilingualInline = ({ tKey, engFallback }) => (
    <>
      {t(tKey, engFallback)}
      {!isEnglish && <span style={{ opacity: 0.6, fontSize: '0.85em', marginLeft: '6px' }}>({engFallback})</span>}
    </>
  );

  const BilingualBlock = ({ tKey, engFallback, className }) => (
    <div className={className}>
      <div>{t(tKey, engFallback)}</div>
      {!isEnglish && (
        <div style={{ fontSize: '0.7em', opacity: 0.7, marginTop: '2px', fontWeight: 'normal' }}>
          {engFallback}
        </div>
      )}
    </div>
  );

  return (
    <div className="dispatch-overlay">
      {/* Sticky header */}
      <div className="dx-header">
        <div className="dx-brand">
          <div className="dx-brand-cross">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M2 12h20" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="dx-brand-name">RoadSOS</div>
            <div className="dx-brand-sub">Emergency Response</div>
          </div>
        </div>
        <div className="dx-header-pills">
          <span className="dx-pill dx-pill-live">
            <span className="dx-pill-dot" />
            LIVE
          </span>
          <span className="dx-pill dx-pill-demo">DEMO</span>
        </div>
      </div>

      <div className="dx-scroll">
        {/* Status banner */}
        <div className="dx-status">
          <div className="dx-status-icon">
            <Check size={18} color="#22C55E" strokeWidth={3} />
          </div>
          <div>
            <div className="dx-status-kicker">
              {isCrash ? (
                <>{t('dispatch.status_dispatched', 'SOS DISPATCHED')} · {stamp}</>
              ) : (
                <>{t('dispatch.status_shared', 'LOCATION SHARED')} · {stamp}</>
              )}
            </div>
            <BilingualBlock 
              tKey={isCrash ? 'dispatch.help_on_way' : 'dispatch.circle_notified'} 
              engFallback={isCrash ? 'Help is on the way.' : 'Your circle has been notified.'} 
              className="dx-status-title" 
            />
          </div>
        </div>

        {/* ETA hero card (Only for crashes) */}
        {isCrash && (
          <div className="dx-eta-card">
            <div>
              <div className="dx-eta-kicker">
                <BilingualInline tKey="dispatch.eta_kicker" engFallback="AMBULANCE ETA" />
              </div>
              <div className="dx-eta-num">
                {String(eta).padStart(2, '0')}
                <span className="dx-eta-unit">{t('dispatch.eta_unit', 'min')}</span>
              </div>
              <div className="dx-eta-source">
                {hospitalContact?.name || 'Apollo Hospital'} ·{' '}
                {typeof hospitalContact?.distance === 'number' ? hospitalContact.distance.toFixed(1) : '2.1'} km
              </div>
            </div>
            <div className="dx-eta-icon">
              <div className="dx-eta-halo" />
              <Ambulance size={26} color="#fff" strokeWidth={2.2} />
            </div>
          </div>
        )}

        {/* What we sent */}
        <div className="dx-section">
          <div className="dx-section-kicker">
            {t('dispatch.live_updating', 'LIVE · UPDATING')}
          </div>
          <BilingualBlock 
            tKey="dispatch.what_we_sent" 
            engFallback="What we sent" 
            className="dx-section-title" 
          />
        </div>

        <div className="dx-rows">
          <div className="dx-row">
            <div>
              <div className="dx-row-label">
                <BilingualInline tKey="dispatch.location" engFallback="LOCATION" />
              </div>
              <div className="dx-row-value dx-row-value-mono dx-row-blue">{formatCoords(location)}</div>
              {landmark && <div className="dx-row-sub">{landmark}</div>}
            </div>
            <span className="dx-row-tag dx-row-tag-live">
              <span className="dx-pill-dot" />
              LIVE
            </span>
          </div>

          {isCrash && (
            <>
              <div className="dx-row">
                <div>
                  <div className="dx-row-label">
                    <BilingualInline tKey="dispatch.speed" engFallback="SPEED AT IMPACT" />
                  </div>
                  <div className="dx-row-value dx-row-value-mono dx-row-blue">— km/h</div>
                </div>
                <span className="dx-row-tag">{t('dispatch.captured', 'CAPTURED')}</span>
              </div>

              <div className="dx-row">
                <div>
                  <div className="dx-row-label">
                    <BilingualInline tKey="dispatch.triage" engFallback="TRIAGE" />
                  </div>
                  <div className="dx-row-value dx-row-red">
                    {triageReason || 'Crash detected · Auto-dispatched'}
                  </div>
                </div>
                <span className="dx-row-tag">{t('dispatch.captured', 'CAPTURED')}</span>
              </div>
            </>
          )}

          <div className="dx-row">
            <div>
              <div className="dx-row-label">
                <BilingualInline tKey="dispatch.battery" engFallback="BATTERY" />
              </div>
              <div className="dx-row-value dx-row-value-mono dx-row-blue">
                {typeof navigator !== 'undefined' && navigator.getBattery ? '—%' : '—%'}
              </div>
            </div>
            <span className="dx-row-tag">{t('dispatch.captured', 'CAPTURED')}</span>
          </div>
        </div>

        {/* Your circle */}
        <div className="dx-section">
          <div className="dx-section-kicker">
            {t('dispatch.who_alerted', 'WHO HAS BEEN ALERTED')}
          </div>
          <BilingualBlock 
            tKey="dispatch.your_circle" 
            engFallback="Your circle" 
            className="dx-section-title" 
          />
        </div>

        <div className="dx-rows">
          <div className="dx-circle-row">
            <div className="dx-circle-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
              </svg>
            </div>
            <div className="dx-circle-body">
              <div className="dx-circle-name">112 Unified</div>
              <div className="dx-circle-role">{t('dispatch.role_emergency', 'Emergency')}</div>
            </div>
            <div className="dx-circle-status">
              <div className="dx-circle-status-line dx-circle-received">
                <Check size={11} strokeWidth={3} />
                {t('dispatch.status_received', 'RECEIVED')}
              </div>
              <div className="dx-circle-time">{t('dispatch.time_instant', 'instant')}</div>
            </div>
          </div>

          {hospitalContact && (
            <div className="dx-circle-row">
              <div className="dx-circle-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
                </svg>
              </div>
              <div className="dx-circle-body">
                <div className="dx-circle-name">{hospitalContact.name}</div>
                <div className="dx-circle-role">{t('dispatch.role_hospital', 'Hospital')}</div>
              </div>
              <div className="dx-circle-status">
                <div className="dx-circle-status-line dx-circle-dispatched">
                  <Check size={11} strokeWidth={3} />
                  {isCrash ? t('dispatch.status_dispatched', 'DISPATCHED') : t('dispatch.status_alerted', 'ALERTED')}
                </div>
                <div className="dx-circle-time">{t('dispatch.time_just_now', 'just now')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <div style={{ padding: '20px 16px 32px' }}>
          <button className="dx-close-btn" onClick={onClose}>
            {t('dispatch.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hospital, Shield, Ambulance, Truck, Wrench, Cog, Car, PhoneCall, Navigation, Zap } from 'lucide-react';
import { guardedTelDial } from '../utils/demoMode';

const CATEGORY_CONFIG = {
  hospital:  { Icon: Hospital,  dot: '#DC2626' },
  police:    { Icon: Shield,    dot: '#1D4ED8' },
  ambulance: { Icon: Ambulance, dot: '#DC2626' },
  towing:    { Icon: Truck,     dot: '#0F766E' },
  repair:    { Icon: Wrench,    dot: '#0F766E' },
  tyre:      { Icon: Cog,       dot: '#6366F1' },
  showroom:  { Icon: Car,       dot: '#10B981' },
};

export default function ContactCard({ contact, isLast }) {
  const { t } = useTranslation();
  const { name, category, distance, phone, isOpen, aiReason, lat, lon } = contact;

  const phoneClean = phone ? phone.replace(/\s+/g, '') : null;
  const callHref   = phoneClean ? `tel:${phoneClean}` : null;

  const mapsHref = (typeof lat === 'number' && typeof lon === 'number')
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
    : null;

  const cat = (category || 'repair').toLowerCase();
  const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.repair;
  const { Icon, dot } = config;

  const kmValue = typeof distance === 'number' ? distance.toFixed(1) : '—';

  // Determine status for left border color (green=reachable, amber=open but far, slate=closed)
  let statusAttr = 'reachable';
  if (isOpen === false) statusAttr = 'closed';
  else if (typeof distance === 'number' && distance >= 4) statusAttr = 'far';

  return (
    <div className="svc-card" data-km={kmValue} data-status={statusAttr}>
      {aiReason && (
        <div className="svc-ai">
          <Zap size={13} fill="currentColor" />
          <span>{aiReason}</span>
        </div>
      )}

      {/* Name row */}
      <div className="svc-main">
        <div className="svc-icon" style={{ background: dot + '18' }}>
          <Icon size={17} color={dot} strokeWidth={2} />
        </div>
        <div className="svc-info">
          <div className="svc-name">{name}</div>
          <div className="svc-status-row">
            {isOpen === true && (
              <>
                <div className="open-dot" style={{ background: '#22C55E' }} />
                <span className="open-label">{t('card.open')}</span>
              </>
            )}
            {isOpen === false && (
              <>
                <div className="closed-dot" style={{ background: '#EF4444' }} />
                <span className="closed-label">{t('card.closed')}</span>
              </>
            )}
            {isOpen === null && (
              <span className="svc-dist" style={{ fontSize: 10 }}>{t('card.unknown_status')}</span>
            )}
            <span style={{ color: '#CBD5E1' }}>·</span>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: 10 }}>{t(`category.${cat === 'tyre' ? 'puncture' : cat}`, cat)}</span>
          </div>
        </div>
      </div>

      {/* Call + Directions row */}
      <div className="call-row">
        {callHref ? (
          <a
            href={callHref}
            className="call-btn"
            id={`call-btn-${phoneClean}`}
            aria-label={`Call ${name} at ${phone}`}
            onClick={(e) => guardedTelDial(e, phoneClean, name)}
          >
            <PhoneCall size={13} className="call-btn-icon" strokeWidth={2.4} fill="#fff" />
            <span className="call-btn-num">{phone}</span>
          </a>
        ) : (
          <div className="call-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            <PhoneCall size={13} strokeWidth={2.4} />
            <span className="call-btn-num">{t('actions.no_phone')}</span>
          </div>
        )}

        {mapsHref && (
          <a
            href={mapsHref}
            className="maps-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open directions to ${name} in Google Maps`}
            style={{ flex: '0 0 auto', marginTop: 0, padding: '0 12px' }}
          >
            <Navigation size={13} color="#1D4ED8" strokeWidth={2.4} />
            {t('actions.directions')}
          </a>
        )}
      </div>
    </div>
  );
}

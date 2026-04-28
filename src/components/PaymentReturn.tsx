import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PaymentReturnProps {
  onActivated: () => void;
  onClose: () => void;
}

const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 1000;
const SUPPORT_EMAIL = 'yaokaize0416@gmail.com';

export const PaymentReturn: React.FC<PaymentReturnProps> = ({ onActivated, onClose }) => {
  const [status, setStatus] = useState<'polling' | 'timeout' | 'error'>('polling');
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelledRef.current) return;
      attempts += 1;
      const { data, error } = await supabase
        .from('entitlements')
        .select('user_id')
        .maybeSingle();
      if (cancelledRef.current) return;
      if (error) {
        setStatus('error');
        return;
      }
      if (data) {
        onActivated();
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        setStatus('timeout');
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      cancelledRef.current = true;
    };
  }, [onActivated]);

  return (
    <div className="paywall-overlay">
      <div className="paywall-card">
        <div className="paywall-header">
          {status === 'polling' && (
            <>
              <h2>Activating your access…</h2>
              <p>This usually takes a few seconds.</p>
            </>
          )}
          {status === 'timeout' && (
            <>
              <h2>Payment received, activating…</h2>
              <p>
                Activation is taking longer than expected. Refresh this page in
                a minute. If the issue persists, contact{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <h2>Couldn't check entitlement</h2>
              <p>
                Please refresh the page. If the issue persists, contact{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </>
          )}
        </div>
        <div className="paywall-body">
          {status === 'polling' ? (
            <div className="spinner" />
          ) : (
            <button className="secondary-button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

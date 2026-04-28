import React, { useState } from 'react';

interface PaywallProps {
  email: string;
  getAccessToken: () => string | null;
  onCancel: () => void;
  onSignOut: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ email, getAccessToken, onCancel, onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = getAccessToken();
      if (!jwt) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        setError(`Checkout failed (${res.status}). Please try again.`);
        setLoading(false);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="paywall-overlay">
      <div className="paywall-card">
        <div className="paywall-header">
          <h2>Unlock the library</h2>
          <p>One-time payment of $9.99 for lifetime access.</p>
        </div>
        <div className="paywall-body">
          <p className="paywall-meta">Signed in as <strong>{email}</strong></p>
          {error && <div className="error-message">{error}</div>}
          <button
            className="submit-button"
            onClick={startCheckout}
            disabled={loading}
          >
            {loading ? 'Redirecting…' : 'Pay $9.99'}
          </button>
          <button className="secondary-button" onClick={onCancel} disabled={loading}>
            Not now
          </button>
          <button className="text-button" onClick={onSignOut} disabled={loading}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

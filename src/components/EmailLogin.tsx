import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface EmailLoginProps {
  onCancel: () => void;
}

export const EmailLogin: React.FC<EmailLoginProps> = ({ onCancel }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="paywall-overlay">
      <div className="paywall-card">
        <div className="paywall-header">
          <h2>Sign in to continue</h2>
          <p>Enter your email and we'll send you a magic link.</p>
        </div>
        {status === 'sent' ? (
          <div className="paywall-body">
            <p>Check <strong>{email}</strong> for a sign-in link. You can close this and click the link in your inbox.</p>
            <button className="secondary-button" onClick={onCancel}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={status === 'sending'}
              />
            </div>
            {errorMsg && <div className="error-message">{errorMsg}</div>}
            <button
              type="submit"
              className="submit-button"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

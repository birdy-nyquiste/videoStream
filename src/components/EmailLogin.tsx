import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface EmailLoginProps {
  onCancel: () => void;
}

export const EmailLogin: React.FC<EmailLoginProps> = ({ onCancel }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [status, setStatus] = useState<'idle' | 'sending' | 'verifying'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setStatus('idle');
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStep('code');
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setStatus('verifying');
    setErrorMsg('');
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    setStatus('idle');
    if (error) {
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="paywall-overlay">
      <div className="paywall-card">
        <div className="paywall-header">
          <h2>Sign in to continue</h2>
          <p>
            {step === 'email'
              ? "Enter your email and we'll send you a 6-digit code."
              : `Enter the code sent to ${email}.`}
          </p>
        </div>
        {step === 'email' ? (
          <form onSubmit={sendCode} className="login-form">
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
            <button type="submit" className="submit-button" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send code'}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="login-form">
            <div className="input-group">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                autoFocus
                disabled={status === 'verifying'}
              />
            </div>
            {errorMsg && <div className="error-message">{errorMsg}</div>}
            <button type="submit" className="submit-button" disabled={status === 'verifying'}>
              {status === 'verifying' ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setStep('email');
                setCode('');
                setErrorMsg('');
              }}
              disabled={status === 'verifying'}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

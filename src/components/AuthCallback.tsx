import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const parseInitial = (): { code: string | null; error: string | null } => {
  if (typeof window === 'undefined') return { code: null, error: null };
  const url = new URL(window.location.href);
  const errParam = url.searchParams.get('error_description') || url.searchParams.get('error');
  return {
    code: url.searchParams.get('code'),
    error: errParam,
  };
};

const initial = parseInitial();

export const AuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(initial.error);

  useEffect(() => {
    if (initial.error) return;

    const finish = () => {
      sessionStorage.setItem('isAuthenticated', 'true');
      window.location.replace('/');
    };

    if (initial.code) {
      supabase.auth.exchangeCodeForSession(initial.code).then(({ error: exchangeErr }) => {
        if (exchangeErr) {
          setError(exchangeErr.message);
          return;
        }
        finish();
      });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        finish();
      } else {
        setError('No session found. Please request a new magic link.');
      }
    });
  }, []);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          {error ? (
            <>
              <h1>Sign-in failed</h1>
              <p>{error}</p>
              <a href="/" className="secondary-button" style={{ marginTop: '1rem', display: 'inline-block' }}>
                Back to login
              </a>
            </>
          ) : (
            <>
              <h1>Signing you in…</h1>
              <p>One moment.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

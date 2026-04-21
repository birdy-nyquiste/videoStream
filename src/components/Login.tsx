import React, { useState, useRef } from 'react';
import { config } from '../config';

interface LoginProps {
  onSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === config.sitePassword) {
      sessionStorage.setItem('isAuthenticated', 'true');
      setIsAnimating(true);
      setTimeout(onSuccess, 400); // Wait for transition
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
      // Quick shake animation
      formRef.current?.classList.add('shake');
      setTimeout(() => formRef.current?.classList.remove('shake'), 400);
    }
  };

  return (
    <div className={`login-container ${isAnimating ? 'fade-out' : ''}`}>
      <div className="login-card">
        <div className="login-header">
          <h1>Secure Access</h1>
          <p>Please enter the password to view this content.</p>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              autoFocus
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-button">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};

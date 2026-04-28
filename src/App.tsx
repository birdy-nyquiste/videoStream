import React, { useState } from 'react';
import { Login } from './components/Login';
import { VideoList } from './components/VideoList';
import { AuthCallback } from './components/AuthCallback';

const isAuthCallbackPath = (): boolean =>
  typeof window !== 'undefined' && window.location.pathname === '/auth/callback';

const App: React.FC = () => {
  const isAuthCallback = isAuthCallbackPath();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isAuthCallback) return false;
    return sessionStorage.getItem('isAuthenticated') === 'true';
  });

  if (isAuthCallback) {
    return (
      <div className="app-container">
        <AuthCallback />
      </div>
    );
  }

  return (
    <div className="app-container">
      {isAuthenticated ? (
        <VideoList />
      ) : (
        <Login onSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
};

export default App;

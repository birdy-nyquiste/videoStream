import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { VideoList } from './components/VideoList';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsInitializing(false);
  }, []);

  if (isInitializing) {
    return null; // Or a sleek loader if preferred
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

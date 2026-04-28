import React, { useState } from 'react';
import { Login } from './components/Login';
import { VideoList } from './components/VideoList';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => sessionStorage.getItem('isAuthenticated') === 'true'
  );

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

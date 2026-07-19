import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithGoogle as firebaseSignIn, logout as firebaseLogout } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [s3Ready, setS3Ready] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setS3Ready(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setS3Ready(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    return firebaseSignIn();
  };

  const logout = async () => {
    return firebaseLogout();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, s3Ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

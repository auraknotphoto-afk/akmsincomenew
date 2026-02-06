'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: { username: string } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  biometricAvailable: boolean;
  loginWithBiometric: () => Promise<boolean>;
  registerBiometric: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default credentials (in production, use proper backend auth)
const DEFAULT_USER = {
  username: 'auraknot',
  password: 'aura@2024'
};

// Session timeout in milliseconds (15 minutes)
const SESSION_TIMEOUT = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const router = useRouter();
  const pathname = usePathname();

  // Check if biometric is available
  useEffect(() => {
    const checkBiometric = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);
      }
    };
    checkBiometric();
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    // Auto-authenticate on localhost (development mode)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setIsAuthenticated(true);
      setUser({ username: 'auraknot' });
      setLoading(false);
      return;
    }
    
    const session = localStorage.getItem('akms_session');
    const sessionTime = localStorage.getItem('akms_session_time');
    
    if (session && sessionTime) {
      const elapsed = Date.now() - parseInt(sessionTime);
      if (elapsed < SESSION_TIMEOUT) {
        setIsAuthenticated(true);
        setUser(JSON.parse(session));
        setLastActivity(Date.now());
      } else {
        // Session expired
        localStorage.removeItem('akms_session');
        localStorage.removeItem('akms_session_time');
      }
    }
    setLoading(false);
  }, []);

  // Auto-logout on inactivity
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkActivity = () => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= SESSION_TIMEOUT) {
        logout();
      }
    };

    const interval = setInterval(checkActivity, 60000); // Check every minute

    const updateActivity = () => {
      setLastActivity(Date.now());
      localStorage.setItem('akms_session_time', Date.now().toString());
    };

    // Track user activity
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [isAuthenticated, lastActivity]);

  // Redirect to login if not authenticated
  useEffect(() => {
    const publicPaths = ['/login'];
    if (!isAuthenticated && !publicPaths.includes(pathname)) {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Simple validation (in production, use proper backend auth)
    if (username === DEFAULT_USER.username && password === DEFAULT_USER.password) {
      const userData = { username };
      setUser(userData);
      setIsAuthenticated(true);
      setLastActivity(Date.now());
      localStorage.setItem('akms_session', JSON.stringify(userData));
      localStorage.setItem('akms_session_time', Date.now().toString());
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('akms_session');
    localStorage.removeItem('akms_session_time');
    router.push('/login');
  };

  // Biometric registration
  const registerBiometric = async (): Promise<boolean> => {
    if (!biometricAvailable) return false;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Aura Knot Photography', id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: DEFAULT_USER.username,
            displayName: 'Aura Knot Photography'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      });

      if (credential) {
        localStorage.setItem('akms_biometric_registered', 'true');
        return true;
      }
    } catch (error) {
      console.error('Biometric registration failed:', error);
    }
    return false;
  };

  // Biometric login
  const loginWithBiometric = async (): Promise<boolean> => {
    if (!biometricAvailable) return false;
    
    const isRegistered = localStorage.getItem('akms_biometric_registered');
    if (!isRegistered) return false;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (credential) {
        const userData = { username: DEFAULT_USER.username };
        setUser(userData);
        setIsAuthenticated(true);
        setLastActivity(Date.now());
        localStorage.setItem('akms_session', JSON.stringify(userData));
        localStorage.setItem('akms_session_time', Date.now().toString());
        return true;
      }
    } catch (error) {
      console.error('Biometric login failed:', error);
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading,
      user,
      login,
      logout,
      biometricAvailable,
      loginWithBiometric,
      registerBiometric
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

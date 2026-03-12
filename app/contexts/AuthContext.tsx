'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: { id: string; username: string } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  biometricAvailable: boolean;
  loginWithBiometric: () => Promise<boolean>;
  registerBiometric: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);
      }
    };
    checkBiometric();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const res = await signIn('basic-login', {
      redirect: false,
      username,
      password,
    });
    return !!res?.ok;
  };

  const logout = () => {
    signOut({ redirect: false });
    router.push('/auth/login');
  };

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
            name: session?.user?.phone || 'user',
            displayName: session?.user?.name || 'Aura Knot Photography',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
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

  // A true biometric sign-in flow requires backend challenge verification.
  // Keep disabled until server-side WebAuthn is implemented.
  const loginWithBiometric = async (): Promise<boolean> => {
    return false;
  };

  const value: AuthContextType = {
    isAuthenticated: status === 'authenticated',
    loading: status === 'loading',
    user: session?.user
      ? {
          id: session.user.id,
          username: session.user.name || session.user.phone || 'User',
        }
      : null,
    login,
    logout,
    biometricAvailable,
    loginWithBiometric,
    registerBiometric,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

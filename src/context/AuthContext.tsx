import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  FirebaseUser 
} from '../services/firebase';
import { 
  loginWithUserId, 
  logoutUser, 
  subscribeUserProfile, 
  ensureDefaultAdminExists,
  getStoredAuthSession
} from '../services/authService';
import { AppUserAccount, AuthRole } from '../types';

interface AuthContextType {
  user: AppUserAccount | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isRandom: boolean;
  authError: string | null;
  login: (role: AuthRole, userId: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with stored local session if present
  const [user, setUser] = useState<AppUserAccount | null>(() => getStoredAuthSession());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize and ensure default admin exists in Firestore
  useEffect(() => {
    ensureDefaultAdminExists().catch(console.warn);
  }, []);

  // Real-time Firestore Profile & Account status synchronization
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    if (user?.id) {
      profileUnsub = subscribeUserProfile(user.id, (account) => {
        if (!account) {
          // Document was deleted
          setUser(null);
          logoutUser();
          setIsLoading(false);
          return;
        }

        // Real-time check if status was changed by Admin
        if (account.status === 'disabled') {
          setUser(null);
          setAuthError("Your account has been disabled. Please contact the administrator.");
          logoutUser();
        } else if (account.status === 'deleted') {
          setUser(null);
          setAuthError("Your account has been deleted or disabled. Please contact the administrator.");
          logoutUser();
        } else if (account.status !== 'active') {
          setUser(null);
          setAuthError("Your account is not active. Please contact the administrator.");
          logoutUser();
        } else {
          setUser(account);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      if (profileUnsub) profileUnsub();
    };
  }, [user?.id]);

  // Firebase Auth State Listener (if Firebase Auth is active)
  useEffect(() => {
    if (!auth) return;

    const authUnsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });

    return () => {
      authUnsub();
    };
  }, []);

  const login = async (role: AuthRole, userId: string, pass: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await loginWithUserId(role, userId, pass);
      setUser(result.userAccount);
      setFirebaseUser(result.firebaseUser);
    } catch (err: any) {
      const msg = err?.message || "Failed to login. Please check your credentials.";
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setFirebaseUser(null);
      setAuthError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setAuthError(null);

  const isAuthenticated = Boolean(user && user.status === 'active');
  const isAdmin = Boolean(isAuthenticated && user?.role === 'admin');
  const isRandom = Boolean(isAuthenticated && user?.role === 'random');

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated,
        isAdmin,
        isRandom,
        authError,
        login,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

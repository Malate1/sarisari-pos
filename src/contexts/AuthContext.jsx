// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthProvider } from "./contexts/AuthContext";
import { db } from './db';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Get initial session
    db.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Welcome back! 🎉', {
        duration: 3000,
        position: 'top-right',
      });

      return { success: true, data };
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to sign in', {
        duration: 4000,
        position: 'top-right',
      });
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user && data.session) {
        toast.success('Account created successfully! 🎉', {
          duration: 3000,
          position: 'top-right',
        });
        return { success: true, data };
      } else if (data.user && !data.session) {
        toast.success('Please check your email to confirm your account! 📧', {
          duration: 5000,
          position: 'top-right',
        });
        return { success: true, requiresConfirmation: true };
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account', {
        duration: 4000,
        position: 'top-right',
      });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      
      toast.success('Signed out successfully', {
        duration: 2000,
        position: 'top-right',
      });
    } catch (error) {
      console.error('Signout error:', error);
      toast.error('Failed to sign out', {
        duration: 3000,
        position: 'top-right',
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
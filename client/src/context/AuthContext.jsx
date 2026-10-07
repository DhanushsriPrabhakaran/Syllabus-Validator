import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      const res = await axios.get('/api/auth/me', { withCredentials: true });
      setUser(res.data.user);
      setError(null);
    } catch (err) {
      setUser(null);
      // 401 is expected when not logged in
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle(credential) {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.post('/api/auth/google', { credential }, { withCredentials: true });
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Authentication failed. Please verify your @tce.edu account.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function devLogin(email = 'staff@tce.edu', name = 'TCE Faculty', department = 'CA', role = 'staff') {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.post('/api/auth/dev-login', { email, name, department, role }, { withCredentials: true });
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Dev login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(department) {
    try {
      setError(null);
      const res = await axios.put('/api/profile', { department }, { withCredentials: true });
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update department';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function logout() {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogle, devLogin, updateProfile, logout, checkAuth }}>
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

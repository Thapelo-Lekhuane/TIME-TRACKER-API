import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  designation?: string;
  campaign?: { id: string; name: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, designation?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('token'));

  useEffect(() => {
    if (token && !user) {
      fetchUser();
    }
  }, [token]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/me');
      setUser(response.data);
    } catch (error: any) {
      console.error('Failed to fetch user', error);
      // Only logout if it's an auth error, not a network error
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken } = response.data;
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
      // Fetch user profile after setting token
      const userResponse = await api.get('/users/me');
      setUser(userResponse.data);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, fullName: string, designation?: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/signup', { email, password, fullName, designation });
      const { accessToken, user: newUser } = response.data;
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
      setUser(newUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // isAuthenticated is true only when we have both token AND user loaded
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

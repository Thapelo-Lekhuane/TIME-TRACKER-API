import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Loading spinner component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #e5e7eb',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#4b5563' }}>Loading...</p>
    </div>
  </div>
);

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show loading screen while checking auth state
  if (loading) {
    return <LoadingScreen />;
  }

  // Not authenticated - show login/signup routes
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Authenticated - show appropriate dashboard based on role
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/signup" element={<Navigate to="/" />} />
      <Route
        path="/"
        element={
          user?.role === 'EMPLOYEE' ? (
            <EmployeeDashboard />
          ) : user?.role === 'MANAGER' ? (
            <ManagerDashboard />
          ) : user?.role === 'ADMIN' ? (
            <AdminDashboard />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;

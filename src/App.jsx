import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return !user ? children : <Navigate to="/" replace />;
};

const AppLoader = () => (
  <div style={{
    height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: 'var(--bg)', fontFamily: 'var(--font-body)',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid var(--border)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 0.8s linear infinite',
    }} />
    <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading InboxHQ…</span>
  </div>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/"         element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
    {/* Own profile route (no id) */}
    <Route path="/profile"  element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    {/* Other user profile route (with id) */}
    <Route path="/profile/:id" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="*"         element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
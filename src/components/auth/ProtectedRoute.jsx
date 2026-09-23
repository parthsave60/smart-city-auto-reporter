import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function ProtectedRoute({ children, requireAuthority = false }) {
  const { user, isAuthority, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 bg-slate flex items-center justify-center shadow-lg"
        >
          <MapPin className="w-6 h-6 text-cream" />
        </motion.div>
      </div>
    );
  }

  // Not logged in -> Redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Requires Authority role, but user is Citizen -> Redirect to Citizen portal
  if (requireAuthority && !isAuthority) {
    return <Navigate to="/my-reports" replace />;
  }

  return children;
}

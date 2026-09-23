import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/layout/Navbar'
import Landing from './pages/Landing'
import ReportIssue from './pages/ReportIssue'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import CitizenReports from './pages/CitizenReports'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ui'

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-cream">
          <Navbar />
          <AnimatePresence mode="wait">
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Protected Citizen & General Routes */}
            <Route 
              path="/report" 
              element={
                <ProtectedRoute>
                  <ReportIssue />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-reports" 
              element={
                <ProtectedRoute>
                  <CitizenReports />
                </ProtectedRoute>
              } 
            />

            {/* Protected Authority Dashboard (Strictly Authority accounts only) */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requireAuthority={true}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  </AuthProvider>
  )
}

export default App

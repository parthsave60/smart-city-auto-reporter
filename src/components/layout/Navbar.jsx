import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll } from 'framer-motion'
import { MapPin, Menu, X, LogOut, User, ArrowRight, Shield, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import NotificationCenter from '../notifications/NotificationCenter'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, userProfile, isAuthority, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  
  const { scrollY } = useScroll()
  
  // Track scroll for navbar style changes
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Define nav links dynamically based on role
  const navLinks = [
    { path: '/', label: 'Home' },
  ]

  if (user) {
    if (isAuthority) {
      navLinks.push({ path: '/dashboard', label: 'Authority Dashboard' })
      navLinks.push({ path: '/report', label: 'Create Report' })
    } else {
      navLinks.push({ path: '/report', label: 'Report Issue' })
      navLinks.push({ path: '/my-reports', label: 'My Reports' })
    }
  } else {
    navLinks.push({ path: '/report', label: 'Report Issue' })
  }

  let displayName = '';
  if (isAuthority) {
    const rawName = userProfile?.firstName 
      ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
      : (user?.displayName || user?.email?.split('@')[0] || 'XYZ');
    const cleaned = rawName.replace(/\b(citizen)\b/gi, '').trim();
    displayName = cleaned || 'XYZ';
  } else {
    displayName = userProfile?.firstName 
      ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
      : (user?.displayName || user?.email?.split('@')[0] || 'Citizen');
  }

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-cream/98 backdrop-blur-lg shadow-md border-b border-cream-muted' 
          : 'bg-cream/80 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-10 h-10 bg-slate flex items-center justify-center group-hover:bg-accent transition-colors duration-300 shadow-md">
                <MapPin className="w-5 h-5 text-cream" strokeWidth={2.5} />
              </div>
              <div className="absolute inset-0 bg-accent/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.div>
            <div className="hidden sm:block">
              <span className="font-display font-bold text-lg text-slate tracking-tight">
                SmartCity
              </span>
              <span className="block text-[10px] font-display uppercase tracking-[0.2em] text-slate-muted -mt-1">
                Reporter
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-4 py-2 font-display text-sm font-medium uppercase tracking-wide transition-colors ${
                  location.pathname === link.path
                    ? 'text-accent'
                    : 'text-slate-muted hover:text-slate'
                }`}
              >
                {location.pathname === link.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <NotificationCenter />

                {/* User Info & Role Tag */}
                <div className="flex items-center gap-2 pl-2 border-l border-cream-muted">
                  <div className="text-right">
                    <span className="font-display font-semibold text-xs text-slate block truncate max-w-[130px]">
                      {displayName}
                    </span>
                    <span className={`text-[10px] font-display uppercase tracking-wider font-bold px-1.5 py-0.5 inline-block ${
                      isAuthority ? 'bg-accent/15 text-accent' : 'bg-slate/10 text-slate-muted'
                    }`}>
                      {isAuthority ? 'AUTHORITY' : 'CITIZEN'}
                    </span>
                  </div>

                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 text-slate-muted hover:text-danger transition-colors ml-1"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={2} />
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-slate-muted hover:text-slate transition-colors"
                >
                  Sign In
                </Link>

                <Link
                  to="/signup"
                  className="px-4 py-2 bg-cream border border-slate/40 hover:border-slate text-slate font-display text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Main Action Button */}
            <Link to="/report">
              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-cream font-display text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition-colors shadow-md relative overflow-hidden"
              >
                <span>{isAuthority ? 'Create Report' : 'Report Issue'}</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </motion.div>
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <motion.button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="md:hidden p-2 text-slate hover:text-accent transition-colors"
          >
            <AnimatePresence mode="wait">
              {mobileMenuOpen ? (
                <X className="w-6 h-6" strokeWidth={2} />
              ) : (
                <Menu className="w-6 h-6" strokeWidth={2} />
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden bg-cream border-t border-cream-muted overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {user && (
                <div className="p-3 bg-cream-dark/60 border border-cream-muted mb-3 flex items-center justify-between">
                  <div>
                    <span className="font-display font-semibold text-xs text-slate block truncate">
                      {displayName}
                    </span>
                    <span className={`text-[10px] font-display uppercase tracking-wider font-bold px-1.5 py-0.5 inline-block ${
                      isAuthority ? 'bg-accent/15 text-accent' : 'bg-slate/10 text-slate-muted'
                    }`}>
                      {isAuthority ? 'AUTHORITY' : 'CITIZEN'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-danger font-display text-xs font-semibold uppercase flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                    location.pathname === link.path
                      ? 'text-accent bg-accent/5'
                      : 'text-slate-muted hover:text-slate'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {!user && (
                <div className="pt-2 border-t border-cream-muted flex gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 border border-cream-muted font-display text-xs font-semibold uppercase tracking-wider text-slate"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 bg-slate text-cream font-display text-xs font-semibold uppercase tracking-wider"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              <Link
                to="/report"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-cream font-display text-xs font-bold uppercase tracking-wider mt-3"
              >
                <span>{isAuthority ? 'Create Report' : 'Report Issue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

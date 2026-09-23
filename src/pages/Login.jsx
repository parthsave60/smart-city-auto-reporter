import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Shield, Sparkles, ArrowRight, Zap, Users, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Premium animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.2,
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: { 
        opacity: 1, 
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
};

const floatVariants = {
    animate: {
        y: [0, -15, 0],
        rotate: [0, 2, -2, 0],
        transition: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
        }
    }
};

const Login = () => {
    const { 
        user, 
        isAuthority, 
        loginCitizenWithGoogle, 
        loginCitizenWithEmail, 
        loginAuthority 
    } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname;

    // Login mode: 'citizen' | 'authority'
    const [loginMode, setLoginMode] = useState('citizen');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            if (isAuthority) {
                navigate(from || '/dashboard');
            } else {
                navigate(from || '/report');
            }
        }
    }, [user, isAuthority, navigate, from]);

    // Handle Citizen Google login
    const handleGoogleLogin = async () => {
        try {
            setAuthError('');
            setIsSubmitting(true);
            const loggedUser = await loginCitizenWithGoogle();
            if (loggedUser) {
                if (isAuthority) {
                    navigate('/dashboard');
                } else {
                    navigate(from || '/report');
                }
            }
        } catch (err) {
            console.error('[Auth] Google sign-in error:', err);
            if (err.code === 'auth/unauthorized-domain') {
                const currentHost = window.location.hostname || 'smartcityautoreporter22.netlify.app';
                setAuthError(
                    `Domain Authorization Notice: Google OAuth requires "${currentHost}" to be listed under Authorized Domains in Firebase.\n\n` +
                    `To authorize:\n` +
                    `1. Open Firebase Console (https://console.firebase.google.com)\n` +
                    `2. Go to Authentication > Settings > Authorized domains\n` +
                    `3. Click "Add domain" and enter: ${currentHost}\n\n` +
                    `Tip: You can immediately sign in below using Citizen Email & Password or Authority Login without domain restrictions.`
                );
            } else if (err.code === 'auth/popup-closed-by-user') {
                setAuthError('Google sign-in popup was closed before completion. Please try again.');
            } else {
                setAuthError(err.message || 'Google sign-in failed. Please try again or use email sign-in.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Citizen Email/Password login
    const handleCitizenLogin = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setAuthError('Please enter your email and password.');
            return;
        }

        try {
            setAuthError('');
            setIsSubmitting(true);
            await loginCitizenWithEmail(email, password);
            navigate(from || '/report');
        } catch (err) {
            console.error('Citizen login error:', err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setAuthError('Invalid email or password. Please check your credentials or create an account.');
            } else {
                setAuthError(err.message || 'Login failed. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Authority Email/Password login
    const handleAuthorityLogin = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setAuthError('Please enter your official Authority email and password.');
            return;
        }

        try {
            setAuthError('');
            setIsSubmitting(true);
            await loginAuthority(email, password);
            navigate('/dashboard');
        } catch (err) {
            console.error('Authority login error:', err);
            setAuthError(err.message || 'Authority authentication failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-16">
            {/* Rich gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-cream via-cream-dark to-cream" />
            
            {/* Animated mesh gradient */}
            <motion.div
                animate={{
                    background: [
                        'radial-gradient(circle at 20% 80%, rgba(232, 77, 28, 0.08) 0%, transparent 50%)',
                        'radial-gradient(circle at 80% 20%, rgba(232, 77, 28, 0.08) 0%, transparent 50%)',
                        'radial-gradient(circle at 40% 40%, rgba(232, 77, 28, 0.08) 0%, transparent 50%)',
                        'radial-gradient(circle at 20% 80%, rgba(232, 77, 28, 0.08) 0%, transparent 50%)',
                    ]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
            />
            
            {/* Blueprint grid */}
            <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        linear-gradient(#3B7DD8 1.5px, transparent 1.5px),
                        linear-gradient(90deg, #3B7DD8 1.5px, transparent 1.5px)
                    `,
                    backgroundSize: '60px 60px',
                    opacity: 0.12,
                    maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 70%)',
                }}
            />
            
            {/* Floating geometric shapes */}
            <motion.div
                variants={floatVariants}
                animate="animate"
                className="absolute top-20 left-[15%] w-16 h-16 border-2 border-accent/30 rotate-45 pointer-events-none"
            />
            <motion.div
                variants={floatVariants}
                animate="animate"
                style={{ animationDelay: '2s' }}
                className="absolute bottom-32 right-[10%] w-24 h-24 border-2 border-blueprint/30 pointer-events-none"
            />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 w-full max-w-lg"
            >
                {/* Layered card */}
                <div className="relative">
                    {/* Background shadow layer */}
                    <div className="absolute -inset-1 bg-slate/5 blur-xl" />
                    
                    {/* Outer geometric frame */}
                    <div className="absolute -inset-4 sm:-inset-6 border border-slate/25 pointer-events-none" />
                    
                    {/* Corner accents */}
                    {[
                        { pos: '-top-4 -left-4 sm:-top-6 sm:-left-6', border: 'border-t-2 border-l-2' },
                        { pos: '-top-4 -right-4 sm:-top-6 sm:-right-6', border: 'border-t-2 border-r-2' },
                        { pos: '-bottom-4 -left-4 sm:-bottom-6 sm:-left-6', border: 'border-b-2 border-l-2' },
                        { pos: '-bottom-4 -right-4 sm:-bottom-6 sm:-right-6', border: 'border-b-2 border-r-2' },
                    ].map((corner, i) => (
                        <div
                            key={i}
                            className={`absolute ${corner.pos} w-8 h-8 sm:w-10 sm:h-10 ${corner.border} border-accent pointer-events-none`}
                        />
                    ))}

                    <motion.div 
                        variants={itemVariants}
                        className="bg-cream/98 backdrop-blur-xl border border-cream-muted shadow-2xl p-8 sm:p-12 relative overflow-hidden"
                    >
                        {/* Top gradient accent */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-accent to-blueprint" />
                        
                        {/* Logo */}
                        <div className="flex justify-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate flex items-center justify-center shadow-lg">
                                    <MapPin className="w-6 h-6 text-cream" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <span className="font-display font-bold text-2xl text-slate tracking-tight">SmartCity</span>
                                    <span className="block text-[10px] font-display uppercase tracking-[0.25em] text-accent font-semibold -mt-1">
                                        Reporter
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-6">
                            <h1 className="font-display text-3xl font-bold text-slate mb-2 tracking-tight">
                                {loginMode === 'citizen' ? 'Citizen Sign In' : 'Authority Portal'}
                            </h1>
                            <p className="font-body text-slate-muted text-sm max-w-sm mx-auto">
                                {loginMode === 'citizen' 
                                    ? 'Sign in to report civic issues and track resolution status in real-time.'
                                    : 'Restricted to authorized municipal inspectors and administrative personnel.'}
                            </p>
                        </div>

                        {/* Two Clear Options / Tabs */}
                        <div className="grid grid-cols-2 p-1.5 bg-cream-dark/60 border border-cream-muted mb-6">
                            <button
                                type="button"
                                onClick={() => { setLoginMode('citizen'); setAuthError(''); }}
                                className={`flex items-center justify-center gap-2 py-2.5 font-display text-sm font-semibold uppercase tracking-wider transition-all duration-300 ${
                                    loginMode === 'citizen'
                                        ? 'bg-slate text-cream shadow-md'
                                        : 'text-slate-muted hover:text-slate'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                <span>Citizen</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginMode('authority'); setAuthError(''); }}
                                className={`flex items-center justify-center gap-2 py-2.5 font-display text-sm font-semibold uppercase tracking-wider transition-all duration-300 ${
                                    loginMode === 'authority'
                                        ? 'bg-accent text-cream shadow-md'
                                        : 'text-slate-muted hover:text-slate'
                                }`}
                            >
                                <Shield className="w-4 h-4" />
                                <span>Authority</span>
                            </button>
                        </div>

                        {/* Error Alert */}
                        {authError && (
                            <motion.div 
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 p-3.5 bg-danger/10 border-l-4 border-danger flex items-start gap-2 text-danger font-body text-sm"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{authError}</span>
                            </motion.div>
                        )}

                        {/* CITIZEN LOGIN SECTION */}
                        {loginMode === 'citizen' && (
                            <div className="space-y-4">
                                {/* Google Sign-In */}
                                <motion.button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={isSubmitting}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-cream border border-cream-muted hover:border-slate/40 text-slate font-display font-semibold text-sm uppercase tracking-wider transition-all shadow-sm hover:shadow"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    <span>Continue with Google</span>
                                </motion.button>

                                <div className="relative flex items-center justify-center my-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-cream-muted" />
                                    </div>
                                    <span className="relative px-3 bg-cream font-display text-xs uppercase tracking-widest text-slate-muted">
                                        or email & password
                                    </span>
                                </div>

                                {/* Citizen Email Form */}
                                <form onSubmit={handleCitizenLogin} className="space-y-4">
                                    <div>
                                        <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="citizen@example.com"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Lock className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate text-cream font-display font-semibold text-sm uppercase tracking-wider hover:bg-slate-light transition-all shadow-md mt-2"
                                    >
                                        <span>{isSubmitting ? 'Signing In...' : 'Sign In as Citizen'}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </motion.button>
                                </form>

                                {/* Separate Sign Up Link */}
                                <div className="text-center pt-3 border-t border-cream-muted">
                                    <p className="font-body text-sm text-slate-muted">
                                        Don&apos;t have an account?{' '}
                                        <Link 
                                            to="/signup" 
                                            className="font-display font-semibold text-accent hover:underline uppercase tracking-wide"
                                        >
                                            Sign Up Here
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* AUTHORITY LOGIN SECTION */}
                        {loginMode === 'authority' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-accent/10 border-l-4 border-accent text-xs font-body text-slate">
                                    <p className="font-semibold font-display text-accent uppercase tracking-wider mb-0.5">
                                        Authorized Access Only
                                    </p>
                                    <p className="text-slate-muted">
                                        Enter your official municipal authority credentials. Unauthorized attempts are strictly logged.
                                    </p>
                                </div>

                                <form onSubmit={handleAuthorityLogin} className="space-y-4">
                                    <div>
                                        <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                            Official Authority Email
                                        </label>
                                        <div className="relative">
                                            <Mail className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="124parth4014@sjcem.edu.in"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-accent outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Lock className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-accent outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-cream font-display font-semibold text-sm uppercase tracking-wider hover:bg-accent-hover transition-all shadow-md mt-2"
                                    >
                                        <Shield className="w-4 h-4" />
                                        <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In as Authority'}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </motion.button>
                                </form>

                                <div className="text-center pt-2">
                                    <p className="text-xs font-body text-slate-muted">
                                        For technical assistance, contact municipal administration.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Bottom Feature Badges */}
                        <div className="mt-6 pt-6 border-t border-cream-muted grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-cream-dark/40">
                                <Shield className="w-4 h-4 text-success mx-auto mb-1" />
                                <span className="block font-display text-[10px] font-semibold uppercase tracking-wider text-slate">Secure</span>
                            </div>
                            <div className="p-2 bg-cream-dark/40">
                                <Sparkles className="w-4 h-4 text-accent mx-auto mb-1" />
                                <span className="block font-display text-[10px] font-semibold uppercase tracking-wider text-slate">AI Verified</span>
                            </div>
                            <div className="p-2 bg-cream-dark/40">
                                <Zap className="w-4 h-4 text-blueprint mx-auto mb-1" />
                                <span className="block font-display text-[10px] font-semibold uppercase tracking-wider text-slate">Real-Time</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, User, Mail, Lock, Phone, Calendar, Home, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Animation variants matching Login.jsx
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.15,
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15, filter: 'blur(6px)' },
    visible: { 
        opacity: 1, 
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
};

export default function SignUp() {
    const { signupCitizen } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        dateOfBirth: '',
        address: '',
    });

    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            setError('Please enter your first and last name.');
            return;
        }

        if (!formData.email.trim()) {
            setError('Please enter a valid email address.');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        try {
            setIsSubmitting(true);
            await signupCitizen({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                dateOfBirth: formData.dateOfBirth,
                address: formData.address,
            }, formData.password);

            // Redirect into application on success
            navigate('/report');
        } catch (err) {
            console.error('Sign-up error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Please sign in instead.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak. Please choose a password with at least 6 characters.');
            } else {
                setError(err.message || 'Failed to create citizen account.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-16">
            {/* Rich gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-cream via-cream-dark to-cream" />
            
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

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 w-full max-w-xl"
            >
                <div className="relative">
                    {/* Shadow layer */}
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
                        className="bg-cream/98 backdrop-blur-xl border border-cream-muted shadow-2xl p-8 sm:p-10 relative overflow-hidden"
                    >
                        {/* Top gradient accent */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-accent to-blueprint" />

                        {/* Logo */}
                        <div className="flex justify-center mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-slate flex items-center justify-center shadow-lg">
                                    <MapPin className="w-5 h-5 text-cream" strokeWidth={2.5} />
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
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate mb-1.5 tracking-tight">
                                Citizen Registration
                            </h1>
                            <p className="font-body text-slate-muted text-xs sm:text-sm max-w-md mx-auto">
                                Create your civic profile to report local road hazards, garbage, and infrastructure issues directly to city departments.
                            </p>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-5 p-3.5 bg-danger/10 border-l-4 border-danger flex items-start gap-2 text-danger font-body text-sm"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Registration Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* First & Last Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                        First Name *
                                    </label>
                                    <div className="relative">
                                        <User className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            placeholder="John"
                                            required
                                            className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                        Last Name *
                                    </label>
                                    <div className="relative">
                                        <User className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            placeholder="Doe"
                                            required
                                            className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                    Email Address *
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="john.doe@example.com"
                                        required
                                        className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                    Password * <span className="text-[10px] text-slate-muted font-normal lowercase">(minimum 6 characters)</span>
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        minLength={6}
                                        required
                                        className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Phone & Date of Birth */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                        Phone Number <span className="text-[10px] text-slate-muted font-normal lowercase">(profile only)</span>
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="+1 (555) 000-0000"
                                            className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                        Date of Birth
                                    </label>
                                    <div className="relative">
                                        <Calendar className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                        <input
                                            type="date"
                                            name="dateOfBirth"
                                            value={formData.dateOfBirth}
                                            onChange={handleChange}
                                            className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                                    Residential / Local Address
                                </label>
                                <div className="relative">
                                    <Home className="w-4 h-4 text-slate-muted absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="123 Civic Center Ave, Ward 4"
                                        className="w-full pl-9 pr-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={isSubmitting}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate text-cream font-display font-semibold text-sm uppercase tracking-wider hover:bg-slate-light transition-all shadow-md mt-4"
                            >
                                <span>{isSubmitting ? 'Registering...' : 'Create Citizen Account'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        </form>

                        {/* Sign In Link */}
                        <div className="text-center pt-5 mt-4 border-t border-cream-muted">
                            <p className="font-body text-sm text-slate-muted">
                                Already have an account?{' '}
                                <Link 
                                    to="/login" 
                                    className="font-display font-semibold text-accent hover:underline uppercase tracking-wide"
                                >
                                    Sign In Here
                                </Link>
                            </p>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}

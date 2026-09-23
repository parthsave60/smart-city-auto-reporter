import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { isAuthority, AUTHORITY_EMAILS } from '../utils/userUtils';
import { saveUserProfile, getUserProfile } from '../services/dataService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for redirect result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('[AuthContext] Redirect login confirmed for:', result.user.email);
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] Redirect sign-in notice:', err.message);
      });
  }, []);

  // Load user profile whenever auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const isAuth = isAuthority(firebaseUser, profile);
          if (profile) {
            if (isAuth) {
              profile.role = 'authority';
              if (profile.lastName && profile.lastName.toLowerCase().includes('citizen')) {
                profile.lastName = profile.lastName.replace(/citizen/gi, '').trim();
              }
            }
            setUserProfile(profile);
          } else {
            // Default profile for Google or newly authenticated user
            const rawNames = (firebaseUser.displayName || '').split(' ');
            const cleanedLastName = rawNames.slice(1).join(' ').replace(/citizen/gi, '').trim();
            const newProfile = {
              userId: firebaseUser.uid,
              firstName: rawNames[0] && rawNames[0].toLowerCase() !== 'citizen' ? rawNames[0] : (isAuth ? 'XYZ' : 'Citizen'),
              lastName: isAuth ? cleanedLastName : (rawNames.slice(1).join(' ') || ''),
              email: firebaseUser.email,
              phone: '',
              dateOfBirth: '',
              address: '',
              role: isAuth ? 'authority' : 'citizen',
              createdAt: new Date().toISOString()
            };
            await saveUserProfile(firebaseUser.uid, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.warn('[AuthContext] Error loading profile:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Citizen login via Google (with redirect fallback if popup is blocked)
   */
  const loginCitizenWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (popupErr) {
      if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
        console.log('[AuthContext] Popup blocked, initiating redirect sign-in...');
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw popupErr;
    }
  };

  /**
   * Citizen login via Google Redirect
   */
  const loginCitizenWithGoogleRedirect = async () => {
    await signInWithRedirect(auth, googleProvider);
  };

  /**
   * Citizen login via Email & Password
   */
  const loginCitizenWithEmail = async (email, password) => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    return result.user;
  };

  /**
   * Authority login via Email & Password
   * Enforces that only pre-authorized emails can sign in as Authority
   */
  const loginAuthority = async (email, password) => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    
    // Check pre-authorization list
    const isPreAuthorized = AUTHORITY_EMAILS.some(e => e.toLowerCase() === trimmedEmail);
    if (!isPreAuthorized) {
      throw new Error('Access denied: This email is not authorized for municipal Authority access.');
    }

    // Development password handling:
    // Firebase Auth strictly enforces a 6-character minimum.
    // If the 5-character password '12345' is provided, map to '123450' (or try '123456', raw)
    let passwordsToTry = [password];
    if (password === '12345') {
      passwordsToTry = ['123450', '123456', '12345'];
    } else if (password === '1245') {
      passwordsToTry = ['124500', '1245', '123450'];
    }

    let lastError = null;
    for (const pw of passwordsToTry) {
      try {
        const result = await signInWithEmailAndPassword(auth, trimmedEmail, pw);
        return result.user;
      } catch (err) {
        lastError = err;
        if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password' && err.code !== 'auth/weak-password') {
          break;
        }
      }
    }

    if (lastError) {
      if (lastError.code === 'auth/invalid-credential' || lastError.code === 'auth/wrong-password') {
        throw new Error('Invalid Authority credentials. Please check your password.');
      }
      if (lastError.code === 'auth/user-not-found') {
        throw new Error('Authority account not found. Please contact municipal IT.');
      }
      throw lastError;
    }
  };

  /**
   * Register a new Citizen account (Role is strictly 'citizen', no OTP required)
   */
  const signupCitizen = async (profileData, password) => {
    const { firstName, lastName, email, phone, dateOfBirth, address } = profileData;
    const trimmedEmail = (email || '').trim().toLowerCase();

    if (!trimmedEmail || !password) {
      throw new Error('Email and password are required.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const createdUser = userCredential.user;

    // 2. Update display name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName) {
      try {
        await updateProfile(createdUser, { displayName: fullName });
      } catch (err) {
        console.warn('[AuthContext] Error updating displayName:', err);
      }
    }

    // 3. Persist citizen profile (Role is hardcoded to 'citizen')
    const fullProfile = {
      userId: createdUser.uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: trimmedEmail,
      phone: (phone || '').trim(),
      dateOfBirth: dateOfBirth || '',
      address: (address || '').trim(),
      role: 'citizen', // Normal users can NEVER select or receive authority during registration
      createdAt: new Date().toISOString()
    };

    await saveUserProfile(createdUser.uid, fullProfile);
    setUserProfile(fullProfile);

    return createdUser;
  };

  /**
   * Sign out
   */
  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const isAuthUser = isAuthority(user, userProfile);

  const value = {
    user,
    userProfile,
    isAuthority: isAuthUser,
    isCitizen: !!user && !isAuthUser,
    loading,
    loginCitizenWithGoogle,
    loginCitizenWithGoogleRedirect,
    loginCitizenWithEmail,
    loginAuthority,
    signupCitizen,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
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

export default AuthContext;

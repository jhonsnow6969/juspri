// frontend/src/components/AuthProvider.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext({});

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    // User is signed in
                    const idToken = await firebaseUser.getIdToken();
                    
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        emailVerified: firebaseUser.emailVerified
                    });
                    
                    setToken(idToken);
                    
                    // Store token in localStorage for persistence
                    localStorage.setItem('authToken', idToken);
                    
                    console.log('✅ User authenticated:', firebaseUser.email);
                } else {
                    // User is signed out
                    setUser(null);
                    setToken(null);
                    localStorage.removeItem('authToken');
                    console.log('ℹ️ User signed out');
                }
            } catch (err) {
                console.error('Auth state change error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    // Refresh token periodically (Firebase tokens expire after 1 hour)
    useEffect(() => {
        if (!user) return;

        const refreshToken = async () => {
            try {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const newToken = await currentUser.getIdToken(true); // Force refresh
                    setToken(newToken);
                    localStorage.setItem('authToken', newToken);
                    console.log('🔄 Token refreshed');
                }
            } catch (err) {
                console.error('Token refresh error:', err);
            }
        };

        // Refresh token every 50 minutes (before 1 hour expiry)
        const interval = setInterval(refreshToken, 50 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            setError(null);
            setLoading(true);
            
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            
            setUser({
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
                emailVerified: result.user.emailVerified
            });
            
            setToken(idToken);
            localStorage.setItem('authToken', idToken);
            
            console.log('✅ Signed in:', result.user.email);
            
            return result.user;
        } catch (err) {
            console.error('Sign in error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            setLoading(true);
            await firebaseSignOut(auth);
            
            setUser(null);
            setToken(null);
            localStorage.removeItem('authToken');
            
            console.log('✅ Signed out');
        } catch (err) {
            console.error('Sign out error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Get fresh auth header for API calls
    const getAuthHeader = async () => {
        if (!token) return null;
        
        // Check if token might be expired and refresh if needed
        const currentUser = auth.currentUser;
        if (currentUser) {
            const freshToken = await currentUser.getIdToken();
            if (freshToken !== token) {
                setToken(freshToken);
                localStorage.setItem('authToken', freshToken);
            }
            return `Bearer ${freshToken}`;
        }
        
        return `Bearer ${token}`;
    };

    const value = {
        user,
        token,
        loading,
        error,
        signInWithGoogle,
        signOut,
        getAuthHeader,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

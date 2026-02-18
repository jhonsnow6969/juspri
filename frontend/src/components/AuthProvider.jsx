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
    const [role, setRole] = useState(null); // <--- ADDED: State for user role
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    // 1. User is signed in - Basic setup
                    const idToken = await firebaseUser.getIdToken();
                    
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        emailVerified: firebaseUser.emailVerified
                    });
                    
                    setToken(idToken);
                    localStorage.setItem('authToken', idToken);

                    // 2. ===== Fetch user role from backend =====
                    try {
                        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                        const response = await fetch(`${apiUrl}/api/user/profile`, {
                            headers: {
                                'Authorization': `Bearer ${idToken}`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            setRole(data.role || 'user');
                            console.log(`✅ User authenticated: ${firebaseUser.email} [Role: ${data.role || 'user'}]`);
                        } else {
                            console.warn('⚠️ Could not fetch role, defaulting to "user"');
                            setRole('user'); 
                        }
                    } catch (fetchError) {
                        console.error('Failed to fetch user role:', fetchError);
                        setRole('user'); // Fallback to basic user if backend fails
                    }
                    // ========================================

                } else {
                    // User is signed out
                    setUser(null);
                    setRole(null); // <--- Reset role
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
            // The onAuthStateChanged listener will handle the state updates
            return result.user;
        } catch (err) {
            console.error('Sign in error:', err);
            setError(err.message);
            setLoading(false); // Only set loading false on error, success is handled by auth listener
            throw err;
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            setLoading(true);
            await firebaseSignOut(auth);
            
            setUser(null);
            setRole(null); // <--- Reset role
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
        role, // <--- ADDED: Exposed in context
        token,
        loading,
        error,
        signInWithGoogle,
        signOut,
        getAuthHeader,
        isAuthenticated: !!user,
        isAdmin: role === 'admin' // Helper boolean for convenience
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
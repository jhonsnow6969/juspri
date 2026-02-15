// frontend/src/components/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Printer, Zap, Shield, Clock } from 'lucide-react';

export function Login() {
    const { signInWithGoogle, error: authError } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Preserve query params when redirecting
    const from = (location.state?.from?.pathname || '') + (location.state?.from?.search || '') || '/';

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError(null);
            
            await signInWithGoogle();
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Login failed:', err);
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">

            <div className="max-w-md w-full relative z-10">
                {/* Main Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 mb-6">
                    {/* Logo/Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg">
                            <Printer className="w-10 h-10 text-black" />
                        </div>
                        <h1 className="text-4xl font-bold text-foreground mb-2">
                            JusPri
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Professional • Fast • Secure
                        </p>
                    </div>

                    {/* Error Message */}
                    {(error || authError) && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-destructive mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-destructive">
                                        Authentication Failed
                                    </p>
                                    <p className="text-sm text-destructive/80 mt-1">
                                        {error || authError}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl group"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Signing in...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <span className="group-hover:translate-x-0.5 transition-transform">Continue with Google</span>
                            </>
                        )}
                    </button>

                    {/* Privacy note */}
                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        Secure authentication via Google OAuth
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-card/60 backdrop-blur-md border border-border rounded-xl p-4 text-center hover:bg-card/80 transition-all duration-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-lg mb-3">
                            <Zap className="w-6 h-6 text-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Instant</p>
                        <p className="text-xs text-muted-foreground mt-1">Fast prints</p>
                    </div>

                    <div className="bg-card/60 backdrop-blur-md border border-border rounded-xl p-4 text-center hover:bg-card/80 transition-all duration-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/10 rounded-lg mb-3">
                            <Shield className="w-6 h-6 text-purple-400" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Secure</p>
                        <p className="text-xs text-muted-foreground mt-1">Protected</p>
                    </div>

                    <div className="bg-card/60 backdrop-blur-md border border-border rounded-xl p-4 text-center hover:bg-card/80 transition-all duration-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-lg mb-3">
                            <Clock className="w-6 h-6 text-emerald-400" />
                        </div>
                        <p className="text-sm font-medium text-foreground">24/7</p>
                        <p className="text-xs text-muted-foreground mt-1">Always on</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
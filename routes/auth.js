import express from 'express';
import supabase from '../database/supabase-client.js';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required' 
        });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Login error:', error);
            return res.status(401).json({ 
                success: false, 
                message: error.message || 'Invalid credentials' 
            });
        }

        if (!data.session) {
            return res.status(401).json({ 
                success: false, 
                message: 'No session created' 
            });
        }

        // Set HTTP-only cookie with the access token
        res.cookie('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: data.session.expires_in * 1000 // Convert seconds to milliseconds
        });

        // Set refresh token cookie
        if (data.session.refresh_token) {
            res.cookie('sb-refresh-token', data.session.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            user: data.user
        });

    } catch (err) {
        console.error('Login server error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// Register route
router.post('/register', async (req, res) => {
    const { email, password, full_name, username } = req.body;
    
    if (!email || !password || !full_name) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email, password, and full name are required' 
        });
    }

    try {
        // Sign up user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name,
                    username: username || full_name
                }
            }
        });

        if (error) {
            console.error('Registration error:', error);
            return res.status(400).json({ 
                success: false, 
                message: error.message 
            });
        }

        if (!data.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Registration failed' 
            });
        }

        // Check if email confirmation is required
        if (!data.session && data.user && !data.user.email_confirmed_at) {
            return res.json({ 
                success: true, 
                message: 'Registration successful! Please check your email for confirmation.',
                requiresEmailConfirmation: true
            });
        }

        // If session is created (auto-confirm enabled)
        if (data.session) {
            // Set HTTP-only cookie with the access token
            res.cookie('sb-access-token', data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: data.session.expires_in * 1000
            });

            // Set refresh token cookie
            if (data.session.refresh_token) {
                res.cookie('sb-refresh-token', data.session.refresh_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                });
            }
        }

        res.json({ 
            success: true, 
            message: 'Registration successful!',
            user: data.user,
            requiresEmailConfirmation: !data.session
        });

    } catch (err) {
        console.error('Registration server error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// Logout route
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies['sb-access-token'];
        
        // Sign out from Supabase if we have a token
        if (token) {
            await supabase.auth.signOut();
        }

        // Clear cookies
        res.clearCookie('sb-access-token');
        res.clearCookie('sb-refresh-token');

        res.json({ 
            success: true, 
            message: 'Logout successful' 
        });

    } catch (err) {
        console.error('Logout error:', err);
        // Still clear cookies even if Supabase logout fails
        res.clearCookie('sb-access-token');
        res.clearCookie('sb-refresh-token');
        
        res.json({ 
            success: true, 
            message: 'Logout completed' 
        });
    }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies['sb-refresh-token'];
        
        if (!refreshToken) {
            return res.status(401).json({ 
                success: false, 
                message: 'No refresh token available' 
            });
        }

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error || !data.session) {
            // Clear invalid cookies
            res.clearCookie('sb-access-token');
            res.clearCookie('sb-refresh-token');
            
            return res.status(401).json({ 
                success: false, 
                message: 'Token refresh failed' 
            });
        }

        // Set new cookies
        res.cookie('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: data.session.expires_in * 1000
        });

        if (data.session.refresh_token) {
            res.cookie('sb-refresh-token', data.session.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        }

        res.json({ 
            success: true, 
            message: 'Token refreshed successfully',
            user: data.user
        });

    } catch (err) {
        console.error('Token refresh error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during token refresh' 
        });
    }
});

// Check auth status
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies['sb-access-token'];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authenticated' 
            });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            res.clearCookie('sb-access-token');
            res.clearCookie('sb-refresh-token');
            
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }

        res.json({ 
            success: true, 
            user 
        });

    } catch (err) {
        console.error('Auth check error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during auth check' 
        });
    }
});

// Google OAuth redirect route
router.get('/google', (req, res) => {
    // Construct the Supabase OAuth URL for Google
    const redirectTo = encodeURIComponent(process.env.SUPABASE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/auth/callback`);
    const supabaseUrl = process.env.SUPABASE_URL;
    const clientId = process.env.SUPABASE_CLIENT_ID; // Not always needed, but can be used for custom providers
    // Supabase OAuth URL for Google
    const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
    res.redirect(url);
});

export default router;
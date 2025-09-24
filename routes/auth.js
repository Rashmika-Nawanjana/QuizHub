import express from 'express';
import supabase from '../database/supabase-client.js';
import { upsertUser } from '../utils/userSync.js';

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

        // Ensure user is in users table
        try {
            await upsertUser(data.user);
        } catch (e) {
            console.error('upsertUser error (login):', e);
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

        // Ensure user is in users table
        try {
            await upsertUser(data.user);
        } catch (e) {
            console.error('upsertUser error (register):', e);
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

// OAuth callback handler: serves a page that extracts tokens from the URL hash and posts them to the backend
router.get('/callback', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OAuth Callback</title>
  <script>
    // Parse hash fragment into an object
    function parseHash(hash) {
      const params = {};
      hash.replace(/^#/, '').split('&').forEach(kv => {
        const [key, value] = kv.split('=');
        params[key] = decodeURIComponent(value || '');
      });
      return params;
    }
    window.onload = function() {
      const params = parseHash(window.location.hash);
      if (params.access_token) {
        // Send tokens to backend to set cookies/session
        fetch('/auth/oauth-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
            expires_in: params.expires_in
          })
        }).then(() => {
          window.location = '/home';
        }).catch(() => {
          document.body.innerHTML = '<h2>OAuth login failed. Please try again.</h2>';
        });
      } else {
        document.body.innerHTML = '<h2>No access token found in callback.</h2>';
      }
    };
  </script>
</head>
<body>
  <h2>Completing login...</h2>
</body>
</html>
    `);
});

// Handler to receive tokens from callback page and set cookies
router.post('/oauth-session', (req, res) => {
  const { access_token, refresh_token, expires_in } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Missing access token' });
  res.cookie('sb-access-token', access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(expires_in || '604800', 10) * 1000
  });
  if (refresh_token) {
    res.cookie('sb-refresh-token', refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  }
  res.status(200).json({ success: true });
});

export default router;
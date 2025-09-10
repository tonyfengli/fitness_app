#!/usr/bin/env node

/**
 * Script to get Spotify refresh token for MVP testing
 * Run with: node scripts/get-spotify-refresh-token.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const url = require('url');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// For local testing, we'll use Postman's OAuth callback
const USE_POSTMAN_CALLBACK = true;
const PORT = 8888;
const REDIRECT_URI = USE_POSTMAN_CALLBACK 
  ? 'https://oauth.pstmn.io/v1/callback'
  : `http://localhost:${PORT}/callback`;

// Required scopes for controlling playback
const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-currently-playing',
  'user-read-playback-position'
].join(' ');

// Generate random state for CSRF protection
const state = crypto.randomBytes(16).toString('hex');

// Create authorization URL
const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.searchParams.append('client_id', CLIENT_ID);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('scope', SCOPES);
authUrl.searchParams.append('state', state);

console.log('\n🎵 Spotify OAuth Token Generator\n');
console.log('This script will help you get a refresh token for the MVP.\n');
console.log('Prerequisites:');
console.log('✓ Spotify Premium account');
console.log('✓ Client ID and Secret in .env file\n');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env file');
  process.exit(1);
}

// Check if REDIRECT_URI matches what's in Spotify app
console.log('ℹ️  Using redirect URI:', REDIRECT_URI);
console.log('   Make sure this matches your Spotify app settings!\n');

// Request handler function
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;
    const returnedState = parsedUrl.query.state;
    
    if (returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: State mismatch</h1>');
      server.close();
      return;
    }
    
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No authorization code received</h1>');
      server.close();
      return;
    }
    
    console.log('✅ Authorization code received, exchanging for tokens...\n');
    
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI
        })
      });
      
      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }
      
      // Get user info
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });
      
      const user = await userResponse.json();
      
      // Success page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Spotify Auth Success</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
              }
              .success { 
                background: #1DB954; 
                color: white; 
                padding: 20px; 
                border-radius: 8px;
                margin-bottom: 20px;
              }
              .token-box {
                background: white;
                border: 2px solid #ddd;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
              }
              .token {
                background: #f0f0f0;
                padding: 10px;
                border-radius: 4px;
                word-break: break-all;
                font-family: monospace;
                margin: 10px 0;
              }
              .instructions {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
              }
              h1, h2 { color: #333; }
              .copy-btn {
                background: #1DB954;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
              }
              .copy-btn:hover { background: #1aa34a; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Success!</h1>
              <p>Authenticated as: <strong>${user.display_name || user.email}</strong></p>
              <p>Account type: <strong>${user.product === 'premium' ? '✨ Premium' : '⚠️  Free (Premium required!)'}</strong></p>
            </div>
            
            <div class="token-box">
              <h2>Your Refresh Token:</h2>
              <div class="token" id="refresh-token">${tokens.refresh_token}</div>
              <button class="copy-btn" onclick="copyToken()">Copy to Clipboard</button>
            </div>
            
            <div class="token-box">
              <h2>Your Spotify User ID:</h2>
              <div class="token" id="user-id">${user.id}</div>
              <button class="copy-btn" onclick="copyUserId()">Copy to Clipboard</button>
            </div>
            
            <div class="instructions">
              <h3>📝 Next Steps:</h3>
              <ol>
                <li>Copy the refresh token above</li>
                <li>Update your <code>.env</code> file:
                  <pre>SPOTIFY_REFRESH_TOKEN="${tokens.refresh_token}"
SPOTIFY_USER_ID="${user.id}"</pre>
                </li>
                <li>Restart your development server</li>
                <li>The TV app should now be able to control Spotify!</li>
              </ol>
            </div>
            
            <script>
              function copyToken() {
                const token = document.getElementById('refresh-token').textContent;
                navigator.clipboard.writeText(token).then(() => {
                  alert('Refresh token copied to clipboard!');
                });
              }
              function copyUserId() {
                const userId = document.getElementById('user-id').textContent;
                navigator.clipboard.writeText(userId).then(() => {
                  alert('User ID copied to clipboard!');
                });
              }
            </script>
          </body>
        </html>
      `);
      
      console.log('\n🎉 SUCCESS! Check your browser for the refresh token.\n');
      console.log(`Refresh Token: ${tokens.refresh_token}\n`);
      console.log(`User ID: ${user.id}\n`);
      console.log('Update your .env file with these values and restart your server.\n');
      
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error.message}</h1>`);
      server.close();
    }
  }
}

let server;

// Create server based on USE_HTTPS flag
if (USE_HTTPS) {
  console.log('⚠️  NOTE: If you see SSL certificate warnings in your browser:');
  console.log('   1. This is expected for localhost');
  console.log('   2. Click "Advanced" → "Proceed to localhost"');
  console.log('   3. Or change USE_HTTPS to false in the script\n');
  
  // Generate self-signed certificate dynamically
  try {
    // Check if openssl is available
    execSync('which openssl', { stdio: 'ignore' });
    
    // Generate temporary certificate files
    const keyPath = '/tmp/spotify-auth-key.pem';
    const certPath = '/tmp/spotify-auth-cert.pem';
    
    // Generate self-signed certificate
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 1 -nodes -subj "/CN=localhost"`, { stdio: 'ignore' });
    
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    
    server = https.createServer(options, handleRequest);
    
    // Clean up temp files
    process.on('exit', () => {
      try {
        fs.unlinkSync(keyPath);
        fs.unlinkSync(certPath);
      } catch (e) {}
    });
  } catch (e) {
    console.log('⚠️  Could not generate HTTPS certificate. Falling back to HTTP...\n');
    console.log('   Update your Spotify app to use: http://localhost:8888/callback\n');
    server = http.createServer(handleRequest);
  }
} else {
  server = http.createServer(handleRequest);
}

server.listen(PORT, () => {
  console.log(`\n🚀 Local server started on port ${PORT}\n`);
  console.log('Opening Spotify login in your browser...\n');
  console.log('If the browser doesn\'t open automatically, visit:');
  console.log(authUrl.toString());
  console.log('\n');
  
  // Try to open browser using dynamic import
  import('open').then(({ default: open }) => {
    open(authUrl.toString()).catch(() => {
      console.log('Could not open browser automatically. Please visit the URL above.');
    });
  }).catch(() => {
    console.log('Note: Could not auto-open browser. Please visit the URL above manually.');
  });
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.\n`);
    console.error('Please close any other processes using this port and try again.\n');
  } else {
    console.error('\n❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...\n');
  server.close();
  process.exit(0);
});
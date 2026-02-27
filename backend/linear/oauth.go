package linear

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	linearAuthorizeURL = "https://linear.app/oauth/authorize"
	linearTokenURL     = "https://api.linear.app/oauth/token"

	// TODO: Replace with your registered Linear OAuth app client ID.
	// Register at: Linear Settings > API > OAuth Applications
	// Redirect URI should be http://localhost (any port).
	defaultClientID = ""
)

type oauthState struct {
	server       *http.Server
	listener     net.Listener
	clientID     string
	redirectURI  string
	state        string
	codeVerifier string
}

type tokenResponse struct {
	AccessToken string   `json:"access_token"`
	TokenType   string   `json:"token_type"`
	ExpiresIn   int64    `json:"expires_in"`
	Scope       []string `json:"scope"`
}

// StartOAuth begins the OAuth PKCE flow. It starts a localhost callback server,
// then opens the user's browser to Linear's authorize page.
func (m *Manager) StartOAuth(clientID string) error {
	if clientID == "" {
		clientID = defaultClientID
	}
	if clientID == "" {
		return fmt.Errorf("no OAuth client ID configured — register an app at Linear Settings > API > OAuth Applications")
	}

	// Generate PKCE code_verifier (43-128 URL-safe chars)
	verifierBytes := make([]byte, 64)
	if _, err := rand.Read(verifierBytes); err != nil {
		return fmt.Errorf("generate code verifier: %w", err)
	}
	codeVerifier := base64.RawURLEncoding.EncodeToString(verifierBytes)

	// Generate code_challenge = base64url(sha256(code_verifier))
	h := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.RawURLEncoding.EncodeToString(h[:])

	// Generate state parameter
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		return fmt.Errorf("generate state: %w", err)
	}
	state := hex.EncodeToString(stateBytes)

	// Start localhost HTTP server on random port
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return fmt.Errorf("start callback server: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	redirectURI := fmt.Sprintf("http://localhost:%d/callback", port)

	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux}

	os := &oauthState{
		server:       srv,
		listener:     listener,
		clientID:     clientID,
		redirectURI:  redirectURI,
		state:        state,
		codeVerifier: codeVerifier,
	}

	m.mu.Lock()
	m.oauth = os
	m.mu.Unlock()

	mux.HandleFunc("/callback", m.handleOAuthCallback)

	// Start server in background
	go func() {
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", err.Error())
		}
	}()

	// Build authorize URL
	params := url.Values{
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"response_type":         {"code"},
		"scope":                 {"read,write"},
		"state":                 {state},
		"code_challenge":        {codeChallenge},
		"code_challenge_method": {"S256"},
		"prompt":                {"consent"},
	}
	authorizeURL := linearAuthorizeURL + "?" + params.Encode()

	// Open browser
	wailsRuntime.BrowserOpenURL(m.ctx, authorizeURL)

	return nil
}

// handleOAuthCallback handles the redirect from Linear after authorization.
func (m *Manager) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()
	os := m.oauth
	m.mu.RUnlock()

	if os == nil {
		http.Error(w, "no OAuth flow in progress", http.StatusBadRequest)
		return
	}

	// Check for error response
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		errDesc := r.URL.Query().Get("error_description")
		msg := fmt.Sprintf("Authorization denied: %s — %s", errParam, errDesc)
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, successHTML("Authorization Failed", msg, false))
		wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", msg)
		go m.shutdownOAuthServer()
		return
	}

	// Validate state
	if r.URL.Query().Get("state") != os.state {
		http.Error(w, "invalid state parameter", http.StatusBadRequest)
		wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", "invalid state parameter")
		go m.shutdownOAuthServer()
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing authorization code", http.StatusBadRequest)
		wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", "missing authorization code")
		go m.shutdownOAuthServer()
		return
	}

	// Exchange code for token
	token, err := m.exchangeCode(code, os)
	if err != nil {
		msg := fmt.Sprintf("Token exchange failed: %s", err)
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, successHTML("Authentication Failed", msg, false))
		wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", msg)
		go m.shutdownOAuthServer()
		return
	}

	// Store the token
	m.mu.Lock()
	m.oauthToken = token.AccessToken
	m.mu.Unlock()

	// Validate token by fetching user info
	me, err := m.GetMe()
	if err != nil {
		m.mu.Lock()
		m.oauthToken = ""
		m.mu.Unlock()
		msg := fmt.Sprintf("Failed to fetch user: %s", err)
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, successHTML("Authentication Failed", msg, false))
		wailsRuntime.EventsEmit(m.ctx, "linear:oauth:error", msg)
		go m.shutdownOAuthServer()
		return
	}

	// Serve success page
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, successHTML("Connected to Linear", fmt.Sprintf("Signed in as %s. You can close this tab.", me.Name), true))

	// Emit success event
	wailsRuntime.EventsEmit(m.ctx, "linear:oauth:complete", map[string]interface{}{
		"me":    me,
		"token": token.AccessToken,
	})

	go m.shutdownOAuthServer()
}

// exchangeCode exchanges an authorization code for an access token.
func (m *Manager) exchangeCode(code string, os *oauthState) (*tokenResponse, error) {
	data := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {os.redirectURI},
		"client_id":     {os.clientID},
		"code_verifier": {os.codeVerifier},
	}

	req, err := http.NewRequest("POST", linearTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var token tokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("parse token response: %w", err)
	}

	if token.AccessToken == "" {
		return nil, fmt.Errorf("empty access token in response")
	}

	return &token, nil
}

// CancelOAuth cancels an in-progress OAuth flow.
func (m *Manager) CancelOAuth() {
	m.shutdownOAuthServer()
}

// Disconnect clears all authentication and stops polling.
func (m *Manager) Disconnect() {
	m.StopPolling()
	m.mu.Lock()
	m.apiKey = ""
	m.oauthToken = ""
	m.mu.Unlock()
}

func (m *Manager) shutdownOAuthServer() {
	m.mu.Lock()
	os := m.oauth
	m.oauth = nil
	m.mu.Unlock()

	if os != nil && os.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		os.server.Shutdown(ctx)
	}
}

func successHTML(title, message string, success bool) string {
	color := "#ef4444"
	icon := "&#10007;"
	if success {
		color = "#6366f1"
		icon = "&#10003;"
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><title>%s</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0;">
<div style="text-align:center;">
<div style="font-size:48px;color:%s;margin-bottom:16px;">%s</div>
<h2 style="margin:0 0 8px;">%s</h2>
<p style="color:#94a3b8;">%s</p>
</div>
</body>
</html>`, title, color, icon, title, message)
}

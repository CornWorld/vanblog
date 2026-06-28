package caddyadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// APIError represents a non-2xx response from the Caddy admin API.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("caddy admin api error: status %d, body: %s", e.StatusCode, e.Body)
}

// Client is an HTTP client for the Caddy admin API (default :2019).
//
// Usage:
//
//	c := caddyadmin.NewClient("http://127.0.0.1:2019")
//	cfg, _ := c.GetConfig()
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient creates a Caddy admin API client.
// baseURL should include the scheme and port, e.g. "http://127.0.0.1:2019".
func NewClient(baseURL string) *Client {
	// Caddy admin endpoint serves HTTP/1.1 only (no HTTP/2).
	// We also disable compression since Caddy admin doesn't benefit from it
	// and some versions handle gzip poorly on the admin port.
	transport := &http.Transport{
		ForceAttemptHTTP2:  false,
		DisableCompression: true,
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http: &http.Client{
			Timeout:   10 * time.Second,
			Transport: transport,
		},
	}
}

// --- Generic config operations ---

// GetConfig returns the full running Caddy configuration.
// GET /config
func (c *Client) GetConfig() (json.RawMessage, error) {
	return c.getRaw("/config")
}

// LoadConfig replaces the entire Caddy configuration atomically.
// POST /load
//
// The new config replaces the old in one swap; Caddy validates before applying.
//
// Caddy restarts its admin HTTP endpoint as part of applying a new config,
// which races with the HTTP response for the /load request itself. The first
// attempt therefore frequently surfaces as an EOF / connection-reset-by-peer
// or a transient 5xx even though the config was accepted. To hide this from
// callers, LoadConfig retries up to 3 times with a 500ms delay between
// attempts, tolerating those transient errors. A non-retryable error (e.g.
// 400 Bad Request from an invalid config) is returned immediately.
func (c *Client) LoadConfig(config json.RawMessage) error {
	var lastErr error
	for i := 0; i < 3; i++ {
		err := c.postRaw("/load", config, nil)
		if err == nil {
			return nil
		}
		lastErr = err
		if !isRetryableLoadError(err) {
			return err
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("caddyadmin: LoadConfig failed after 3 retries: %w", lastErr)
}

// ValidateConfig runs Caddy's dry-run validation on the config without
// applying it. POST /load?validate_only=true.
//
// Useful for sanity-checking a generated config (e.g. from BuildFullConfig)
// before committing it via LoadConfig. A nil error means Caddy accepted the
// config as well-formed.
func (c *Client) ValidateConfig(config json.RawMessage) error {
	return c.postRaw("/load?validate_only=true", config, nil)
}

// isRetryableLoadError reports whether err looks like the kind of transient
// failure Caddy produces while restarting its admin endpoint during /load:
//   - EOF / connection reset by peer / broken pipe (socket torn down mid-response)
//   - 5xx from the admin API (admin not yet back up)
//
// 4xx errors (bad config) and everything else are NOT retryable.
func isRetryableLoadError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, "EOF") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "broken pipe") {
		return true
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode >= 500
	}
	return false
}

// GetConfigPath returns a specific subtree of the Caddy configuration.
// GET /config/{path}
//
// Example: GetConfigPath("apps/http/servers/srv0/routes") -> []Route
func (c *Client) GetConfigPath(path string) (json.RawMessage, error) {
	return c.getRaw("/config/" + strings.TrimLeft(path, "/"))
}

// --- HTTP server status inspection ---

// GetRoutes returns all routes for the specified server. Read-only status
// inspection used by GetTLSStatus to detect "still in maintenance mode".
// GET /config/apps/http/servers/{serverName}/routes
func (c *Client) GetRoutes(serverName string) ([]Route, error) {
	path := fmt.Sprintf("apps/http/servers/%s/routes", serverName)
	raw, err := c.getRaw("/config/" + path)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var routes []Route
	if err := json.Unmarshal(raw, &routes); err != nil {
		return nil, fmt.Errorf("caddyadmin: failed to decode routes: %w", err)
	}
	return routes, nil
}

// GetAutocertDomains returns the list of domains with automatic certificate
// management. Used by GetTLSStatus to show which domains currently have certs.
// GET /config/apps/tls/certificates/automate
func (c *Client) GetAutocertDomains() ([]string, error) {
	raw, err := c.GetConfigPath("apps/tls/certificates/automate")
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var domains []string
	if err := json.Unmarshal(raw, &domains); err != nil {
		return nil, fmt.Errorf("caddyadmin: failed to decode autocert domains: %w", err)
	}
	return domains, nil
}

// --- Low-level HTTP helpers ---

func (c *Client) getRaw(path string) (json.RawMessage, error) {
	resp, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (c *Client) postRaw(path string, body []byte, out any) error {
	resp, err := c.do(http.MethodPost, path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func (c *Client) do(method, path string, body io.Reader) (*http.Response, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("caddyadmin: failed to create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("caddyadmin: request to %s failed: %w", url, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, &APIError{StatusCode: resp.StatusCode, Body: string(errBody)}
	}
	return resp, nil
}

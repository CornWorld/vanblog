package caddyadmin

import (
	"bytes"
	"context"
	"encoding/json"
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
//	c.AddRoute(caddyadmin.Route{ID: "my-proxy", ...})
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
// The new config replaces the old in one swap; Caddy validates before applying.
func (c *Client) LoadConfig(config json.RawMessage) error {
	return c.postRaw("/load", config, nil)
}

// GetConfigPath returns a specific subtree of the Caddy configuration.
// GET /config/{path}
//
// Example: GetConfigPath("apps/http/servers/srv0/routes") -> []Route
func (c *Client) GetConfigPath(path string) (json.RawMessage, error) {
	return c.getRaw("/config/" + strings.TrimLeft(path, "/"))
}

// PatchConfigPath updates a specific subtree of the Caddy configuration.
// PATCH /config/{path}
//
// The value is JSON-encoded and sent as the request body.
// Caddy applies the patch atomically.
func (c *Client) PatchConfigPath(path string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("caddyadmin: failed to marshal patch value: %w", err)
	}
	return c.patchRaw("/config/"+strings.TrimLeft(path, "/"), body)
}

// PutConfigPath replaces a specific subtree of the Caddy configuration.
// PUT /config/{path}
func (c *Client) PutConfigPath(path string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("caddyadmin: failed to marshal put value: %w", err)
	}
	return c.putRaw("/config/"+strings.TrimLeft(path, "/"), body)
}

// DeleteConfigPath deletes a specific subtree of the Caddy configuration.
// DELETE /config/{path}
func (c *Client) DeleteConfigPath(path string) error {
	return c.deleteRaw("/config/" + strings.TrimLeft(path, "/"))
}

// --- TLS management ---

// GetTLSSubjects returns the current TLS automation policy subjects.
// Equivalent to: GET /config/apps/tls/automation/policies/0/subjects
func (c *Client) GetTLSSubjects() ([]string, error) {
	raw, err := c.GetConfigPath("apps/tls/automation/policies/0/subjects")
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var subjects []string
	if err := json.Unmarshal(raw, &subjects); err != nil {
		return nil, fmt.Errorf("caddyadmin: failed to decode TLS subjects: %w", err)
	}
	return subjects, nil
}

// UpdateTLSSubjects sets the TLS automation policy subjects (domain whitelist for on-demand TLS).
// PATCH /config/apps/tls/automation/policies/0/subjects
func (c *Client) UpdateTLSSubjects(domains []string) error {
	return c.PatchConfigPath("apps/tls/automation/policies/0/subjects", domains)
}

// GetAutocertDomains returns the list of domains with automatic certificate management.
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

// UpdateAutocertDomains sets the list of domains for automatic certificate management.
// PATCH /config/apps/tls/certificates/automate
func (c *Client) UpdateAutocertDomains(domains []string) error {
	return c.PatchConfigPath("apps/tls/certificates/automate", domains)
}

// --- HTTP server ---

// SetHTTPRedirect enables or disables automatic HTTP→HTTPS redirect.
// When enabled, Caddy wraps the HTTPS server's listener with http_redirect.
//
// POST/DELETE /config/apps/http/servers/{serverName}/listener_wrappers
func (c *Client) SetHTTPRedirect(serverName string, enable bool) error {
	path := fmt.Sprintf("apps/http/servers/%s/listener_wrappers", serverName)
	if enable {
		wrappers := []map[string]string{{"wrapper": "http_redirect"}}
		return c.postRaw("/config/"+path, mustJSON(wrappers), nil)
	}
	return c.deleteRaw("/config/" + path)
}

// --- Route management (based on @id) ---

// AddRoute appends a route to the specified server's route list.
// Caddy's "..." append doesn't work for nested arrays, so we
// read the current routes, append, and PATCH the whole array back.
func (c *Client) AddRoute(serverName string, route Route) error {
	path := fmt.Sprintf("apps/http/servers/%s/routes", serverName)
	// Read existing routes
	existing, err := c.GetRoutes(serverName)
	if err != nil {
		return fmt.Errorf("caddyadmin: AddRoute: failed to read existing routes: %w", err)
	}
	// Append new route
	updated := append(existing, route)
	// Write back
	return c.PatchConfigPath(path, updated)
}

// RemoveRoute removes a route by its @id.
// DELETE /id/{id}
func (c *Client) RemoveRoute(id string) error {
	return c.deleteRaw("/id/" + id)
}

// GetRoute returns a route by its @id.
// GET /id/{id}
func (c *Client) GetRoute(id string) (*Route, error) {
	raw, err := c.getRaw("/id/" + id)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var route Route
	if err := json.Unmarshal(raw, &route); err != nil {
		return nil, fmt.Errorf("caddyadmin: failed to decode route: %w", err)
	}
	return &route, nil
}

// GetRoutes returns all routes for the specified server.
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

func (c *Client) patchRaw(path string, body []byte) error {
	resp, err := c.do(http.MethodPatch, path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) putRaw(path string, body []byte) error {
	resp, err := c.do(http.MethodPut, path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) deleteRaw(path string) error {
	resp, err := c.do(http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
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

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// unlock.go — server-side password verification for locked posts.
//
// The enrich hook (enrich.go) masks content+password on anonymous API reads,
// so the theme can no longer verify the password client-side against the
// fetched row (that verification was cosmetic anyway: the row itself was the
// leak). This endpoint reads the record server-side — internal queries
// bypass API masking — and returns the markdown content only when the
// request proves knowledge of the password or presents a valid signed unlock
// cookie.
//
// The cookie is an HMAC token (expiry + signature) keyed with the `users`
// collection's AuthToken secret — stable per install, never exposed. Forging
// it requires that server-side secret, unlike the previous literal "true"
// cookie which anyone could set.
package article

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

const (
	unlockCookiePrefix = "vb-unlock-"
	unlockTTL          = 7 * 24 * time.Hour
	// Failed password attempts allowed per IP per window before 429.
	unlockMaxAttempts = 10
	unlockWindow      = time.Minute
)

type unlockRequest struct {
	Password string `json:"password"`
	// BasePath is the deployment base path (e.g. "" or "/themes/vanblog")
	// so the unlock cookie's Path matches the page URL — dev multi-theme
	// mounts live under /themes/<name>/.
	BasePath string `json:"basePath"`
}

// attemptLimiter is a minimal in-memory fixed-window limiter for failed
// password attempts. Single-process by design (vault is one binary); a
// restart resets it, which only widens the window by one period.
type attemptLimiter struct {
	mu     sync.Mutex
	failed map[string][]time.Time
}

func (l *attemptLimiter) allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.failed == nil {
		l.failed = make(map[string][]time.Time)
	}
	recent := l.failed[ip][:0]
	for _, t := range l.failed[ip] {
		if now.Sub(t) < unlockWindow {
			recent = append(recent, t)
		}
	}
	l.failed[ip] = recent
	return len(recent) < unlockMaxAttempts
}

func (l *attemptLimiter) record(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.failed == nil {
		l.failed = make(map[string][]time.Time)
	}
	l.failed[ip] = append(l.failed[ip], time.Now())
}

// unlockKey derives the HMAC key. The users AuthToken secret is generated at
// collection creation, persisted in the DB, and never leaves the server.
func (m *Manager) unlockKey() ([]byte, error) {
	col, err := m.app.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, fmt.Errorf("article: users collection not found: %w", err)
	}
	if col.AuthToken.Secret == "" {
		return nil, fmt.Errorf("article: users AuthToken secret is empty")
	}
	return []byte(col.AuthToken.Secret), nil
}

func (m *Manager) signUnlockToken(postID string, exp int64) (string, error) {
	key, err := m.unlockKey()
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, key)
	fmt.Fprintf(mac, "%s|%d", postID, exp)
	return fmt.Sprintf("%d.%s", exp, hex.EncodeToString(mac.Sum(nil))), nil
}

func (m *Manager) validUnlockToken(postID, token string) bool {
	expStr, sig, ok := strings.Cut(token, ".")
	if !ok {
		return false
	}
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	key, err := m.unlockKey()
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, key)
	fmt.Fprintf(mac, "%s|%d", postID, exp)
	want := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(want))
}

// requestIsHTTPS reports whether the request reached the server over TLS.
// Behind the bundled Caddy (or a compliant reverse proxy) Go only sees plain
// HTTP, so the forwarded proto header decides; direct TLS (e.g. admin port)
// falls back to r.TLS.
func requestIsHTTPS(e *core.RequestEvent) bool {
	if e.Request == nil {
		return false
	}
	if p := e.Request.Header.Get("X-Forwarded-Proto"); p != "" {
		return p == "https"
	}
	return e.Request.TLS != nil
}

// setUnlockCookie issues a fresh signed unlock cookie scoped to the post
// page URL.
func (m *Manager) setUnlockCookie(e *core.RequestEvent, postID, basePath string) error {
	token, err := m.signUnlockToken(postID, time.Now().Add(unlockTTL).Unix())
	if err != nil {
		return err
	}
	basePath = strings.TrimSuffix(basePath, "/")
	if basePath != "" && (!strings.HasPrefix(basePath, "/") || len(basePath) > 256) {
		basePath = ""
	}
	// #nosec G124 -- Secure must stay deployment-dependent: the
	// VANBLOG_HTTP_ONLY mode serves plain HTTP, where a Secure cookie is
	// dropped by the browser and unlock breaks. The token is HMAC-signed,
	// HttpOnly and SameSite=Lax, so it cannot be forged or read by JS;
	// TLS-terminating deployments (the default, via bundled Caddy) set
	// the flag from the forwarded proto.
	e.SetCookie(&http.Cookie{ // #nosec G124 -- Secure is deployment-dependent, see above
		Name:     unlockCookiePrefix + postID,
		Value:    token,
		MaxAge:   int(unlockTTL.Seconds()),
		Path:     basePath + "/post/" + postID,
		Secure:   requestIsHTTPS(e),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// handleUnlock serves POST /api/vanblog/posts/{id}/unlock.
//
// Body (both fields optional): {"password": "...", "basePath": "/x"}.
// Success → 200 {content: "<markdown>"} + Set-Cookie unlock token.
// Wrong/no password without valid cookie → 401; too many failures → 429;
// missing/deleted/private/unpublished/no-password post → 404 (no oracle about
// which case applies).
func (m *Manager) handleUnlock(e *core.RequestEvent) error {
	postID := e.Request.PathValue("id")
	var req unlockRequest
	// Body is optional (cookie replay sends {}): tolerate empty/invalid
	// JSON and treat it as "no password provided".
	if body, err := io.ReadAll(io.LimitReader(e.Request.Body, 4<<10)); err == nil && len(body) > 0 {
		_ = json.Unmarshal(body, &req)
	}

	post, err := m.app.FindRecordById("posts", postID)
	if err != nil ||
		post.GetBool("deleted") ||
		post.GetBool("private") ||
		post.GetString("status") != "published" ||
		post.GetString("password") == "" {
		// private: the endpoint reads records server-side, bypassing the API
		// rules that hide private posts from anonymous readers — without this
		// check, a private+locked post's content is redeemable by password.
		return e.JSON(http.StatusNotFound, map[string]string{"message": "文章不存在"})
	}

	cookieName := unlockCookiePrefix + post.Id
	if c, cerr := e.Request.Cookie(cookieName); cerr == nil && m.validUnlockToken(post.Id, c.Value) {
		return m.unlockSuccess(e, post, req.BasePath)
	}

	if req.Password != "" {
		if subtle.ConstantTimeCompare([]byte(req.Password), []byte(post.GetString("password"))) == 1 {
			return m.unlockSuccess(e, post, req.BasePath)
		}
		ip := clientIP(e)
		if !m.unlockAttempts.allow(ip) {
			return e.JSON(http.StatusTooManyRequests, map[string]string{"message": "尝试过于频繁，请稍后再试"})
		}
		m.unlockAttempts.record(ip)
	}
	return e.JSON(http.StatusUnauthorized, map[string]string{"message": "密码错误！请重试！"})
}

// clientIP extracts the remote host from the request. Throttle key only —
// never logged or stored.
func clientIP(e *core.RequestEvent) string {
	host, _, err := net.SplitHostPort(e.Request.RemoteAddr)
	if err != nil {
		return e.Request.RemoteAddr
	}
	return host
}
func (m *Manager) unlockSuccess(e *core.RequestEvent, post *core.Record, basePath string) error {
	if err := m.setUnlockCookie(e, post.Id, basePath); err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]string{"message": "签发解锁凭证失败"})
	}
	return e.JSON(http.StatusOK, map[string]string{"content": post.GetString("content")})
}

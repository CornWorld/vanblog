// Package audit provides platform audit logging over the shared `audits`
// collection (schema: pb_migrations/1782200000_init_vanblog_collections.go).
//
// 2026-09-17: replaces the per-collection JSVM audit hooks (system.pb.js +
// lib/vanblog-audit.js, now retired). Motivation and boundary criteria:
// docs/pocketbase-extension-contract.md「扩展边界判据」.
//
// Why Go wildcard hooks win over the JS version:
//   - untagged OnRecord*Request fire for EVERY collection, including Pack
//     tables created at runtime by JS migrations (the JS version audited
//     only its six hardcoded collections — moments/bookmarks/... had zero
//     coverage);
//   - full slog/Go-test/type safety; facts 9/10/12 of the contract doc
//     (exception swallowing, logger blindness, staging watcher) stop
//     applying to the audit path.
//
// Semantics kept identical to the JS version:
//   - Request hooks only: e.Next() runs first, audit records AFTER the
//     write succeeded; a failed op produces no row; Go-internal app.Save
//     (counters, cache invalidation, dedup) produces no row. Audit =
//     what authenticated people did over HTTP.
//   - actor is set only for users-collection auth (superuser ops get an
//     empty actor = system action; audits.actor is a users relation).
//   - users.update with no auth falls back to actor = record id
//     (self-service profile edit attribution).
//   - skip list: "audits" (no recursion) and "visits" (anonymous
//     telemetry, not an attributable action).
//
// Semantics deliberately changed:
//   - the JS hookError "audits failure row + console.error" channel is
//     replaced by structured slog — when the audits write itself fails,
//     writing another audits row was never possible anyway; the log line
//     is the honest surface.
//   - auth.login rows are back: onRecordAuthRequest fired "auth.login" in
//     the original design (338b6f42), was dropped in the bd4aee11
//     retreat, and the helper sat exported-but-unwired ever since.
//
// Unknown (Pack) collections get action "<collection>.<op>", target
// "<id>[:<title|name>]" and a minimal detail — Pack record bodies can be
// megabytes; audit rows must stay small.
package audit

import (
	"encoding/json"
	"log/slog"

	"github.com/pocketbase/pocketbase/core"
)

// Manager registers wildcard audit hooks. Construct via New(app).
type Manager struct {
	app core.App
}

// New creates the audit Manager and binds its pb hooks. Safe to construct
// multiple times per app only once — like every manager, call once from
// main.go.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnRecordCreateRequest().BindFunc(m.onRecord("create"))
	app.OnRecordUpdateRequest().BindFunc(m.onRecord("update"))
	app.OnRecordDeleteRequest().BindFunc(m.onRecord("delete"))
	app.OnRecordAuthRequest().BindFunc(m.onAuth)
	return m
}

// skipCollections: audits = no self-auditing recursion; visits = anonymous
// page-view telemetry (the /api/vanblog/visits/record hot path is an
// internal app.Save anyway and never hits Request hooks).
var skipCollections = map[string]bool{
	"audits": true,
	"visits": true,
}

// auditSpec pins action prefixes and row shapes for the collections the
// retired JS version covered — action strings ("post.create", ...) and
// detail keys are kept byte-compatible so existing audits consumers (admin
// UI, dashboards) see no diff.
type auditSpec struct {
	prefix string
	label  func(rec *core.Record) string
	detail func(rec *core.Record) map[string]any
}

func opt(v any) any {
	if v == nil {
		return []any{}
	}
	return v
}

var coreSpecs = map[string]auditSpec{
	"posts": {"post",
		func(r *core.Record) string { return r.GetString("title") },
		func(r *core.Record) map[string]any {
			return map[string]any{
				"id": r.Id, "title": r.GetString("title"),
				"status": r.GetString("status"), "pathname": r.GetString("pathname"),
				"category": r.GetString("category"), "tags": opt(r.Get("tags")),
				"deleted": r.GetBool("deleted"),
			}
		}},
	"tags": {"tag",
		func(r *core.Record) string { return r.GetString("name") },
		func(r *core.Record) map[string]any {
			return map[string]any{
				"id": r.Id, "name": r.GetString("name"), "slug": r.GetString("slug"),
			}
		}},
	"categories": {"category",
		func(r *core.Record) string { return r.GetString("name") },
		func(r *core.Record) map[string]any {
			return map[string]any{
				"id": r.Id, "name": r.GetString("name"),
				"type": r.GetString("type"), "private": r.GetBool("private"),
			}
		}},
	"media": {"media",
		func(r *core.Record) string {
			if f := r.GetString("file"); f != "" {
				return f
			}
			return r.GetString("staticType")
		},
		func(r *core.Record) map[string]any {
			return map[string]any{
				"id": r.Id, "file": r.GetString("file"),
				"staticType": r.GetString("staticType"), "storageType": r.GetString("storageType"),
			}
		}},
	"users": {"user",
		func(r *core.Record) string { return r.GetString("username") },
		func(r *core.Record) map[string]any {
			return map[string]any{
				"id": r.Id, "username": r.GetString("username"),
				"nickname": r.GetString("nickname"), "email": r.GetString("email"),
				"role": r.GetString("role"), "permissions": opt(r.Get("permissions")),
			}
		}},
	"site": {"site",
		func(*core.Record) string { return "site" },
		func(r *core.Record) map[string]any {
			return map[string]any{
				"siteName": r.GetString("siteName"), "baseUrl": r.GetString("baseUrl"),
				"palette": r.Get("palette"), "activeTheme": r.GetString("activeTheme"),
				"httpsRedirect": r.GetBool("httpsRedirect"),
			}
		}},
}

// onRecord returns the wildcard Request hook for one operation. e.Next()
// runs first (fact 11 discipline): audit rows are only written for ops
// that succeeded, and the row is written after the write landed.
func (m *Manager) onRecord(op string) func(e *core.RecordRequestEvent) error {
	return func(e *core.RecordRequestEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		m.record(op, e)
		return nil
	}
}

func (m *Manager) record(op string, e *core.RecordRequestEvent) {
	// Audit is observability, never correctness: a bug here must not
	// corrupt an already-succeeded HTTP op (JS hookError contract).
	defer func() {
		if r := recover(); r != nil {
			m.app.Logger().Error("audit panic recovered", "collection", e.Collection.Name, "panic", r)
		}
	}()

	name := e.Collection.Name
	if skipCollections[name] {
		return
	}

	// actor: only users-collection auth (superuser → empty = system action).
	actor := ""
	if e.Auth != nil && e.Auth.Collection().Name == "users" {
		actor = e.Auth.Id
	}

	action := name + "." + op
	detail := map[string]any{"id": e.Record.Id, "collection": name}
	target := e.Record.Id
	if spec, known := coreSpecs[name]; known {
		action = spec.prefix + "." + op
		detail = spec.detail(e.Record)
		if l := spec.label(e.Record); l != "" {
			target = e.Record.Id + ":" + l
		}
	} else {
		// Pack/unknown collection: keep the JS targetOf behaviour —
		// append a human label when a common one exists.
		for _, field := range []string{"title", "name"} {
			if l := e.Record.GetString(field); l != "" {
				target = e.Record.Id + ":" + l
				detail[field] = l
				break
			}
		}
	}

	// users.update self-service: unauthenticated self edits attribute to
	// the edited record itself (parity with JS userAction fallbackSelf).
	if name == "users" && op == "update" && actor == "" {
		actor = e.Record.Id
	}

	m.write(actor, action, target, detail, e.RealIP(), userAgent(e.RequestEvent))
}

// onAuth restores login auditing (original 338b6f42 intent, lost in the
// bd4aee11 After*Success retreat and never re-wired).
func (m *Manager) onAuth(e *core.RecordAuthRequestEvent) error {
	if err := e.Next(); err != nil {
		return err
	}
	// auth-refresh 与 superuser impersonate 复用本钩子且 AuthMethod 为空
	// (PB apis/record_auth_refresh.go:33 传 "")——它们不是登录。SDK 中间件
	// 对每个带认证 cookie 的请求 authRefresh,不豁免则每个已认证请求都会
	// 写一条 auth.login,真实登录被噪音淹没。
	if e.AuthMethod == "" {
		return nil
	}
	rec := e.Record
	if rec == nil || rec.Collection().Name != "users" {
		return nil
	}
	target := rec.GetString("email")
	if target == "" {
		target = rec.GetString("username")
	}
	if target == "" {
		target = rec.Id
	}
	// JS authLogin wrote no detail — parity.
	m.write(rec.Id, "auth.login", target, nil, e.RealIP(), userAgent(e.RequestEvent))
	return nil
}

func userAgent(e *core.RequestEvent) string {
	if e == nil || e.Request == nil {
		return ""
	}
	return e.Request.Header.Get("User-Agent")
}

// write persists one audits row. Failures degrade to structured logs —
// an audit failure must never surface as a 500 on a succeeded operation.
func (m *Manager) write(actor, action, target string, detail any, ip, ua string) {
	logger := m.app.Logger()
	col, err := m.app.FindCollectionByNameOrId("audits")
	if err != nil {
		logger.Error("audit: audits collection missing", "action", action, "err", err)
		return
	}
	detailStr := ""
	if detail != nil {
		raw, err := json.Marshal(detail)
		if err != nil {
			logger.Error("audit: detail marshal failed", "action", action, "err", err)
			return
		}
		detailStr = string(raw)
	}
	rec := core.NewRecord(col)
	if actor != "" {
		rec.Set("actor", actor)
	}
	rec.Set("action", action)
	rec.Set("target", target)
	rec.Set("result", "success")
	rec.Set("detail", detailStr)
	rec.Set("ip", ip)
	rec.Set("userAgent", ua)
	if err := m.app.Save(rec); err != nil {
		logger.Error("audit write failed", "action", action, "target", target, slog.String("err", err.Error()))
	}
}

// enrich.go — keeps locked content and category passwords off the anonymous
// API surface.
//
// posts rows with a password are publicly listable by design (upstream shows
// a locked teaser card in lists), but the full row — content AND password —
// used to be readable by anyone via /api/collections/posts/*. The enrich
// hook below masks content+password for unauthenticated requests while
// leaving hasPassword visible, so the theme can still render the unlock UI.
// Password verification moved to POST /api/vanblog/posts/{id}/unlock
// (unlock.go), which reads the record server-side, bypassing API masking.
package article

import "github.com/pocketbase/pocketbase/core"

// RegisterContentHygieneHooks subscribes the write + enrich hooks.
// Called from New.
func RegisterContentHygieneHooks(app core.App) {
	// hasPassword mirrors password presence on every write path (REST,
	// zip import, devseed) so anonymous readers can distinguish "locked"
	// from "empty" after the enrich hook masks password/content.
	syncHasPassword := func(e *core.RecordEvent) error {
		e.Record.Set("hasPassword", e.Record.GetString("password") != "")
		return e.Next()
	}
	app.OnRecordCreate("posts").BindFunc(syncHasPassword)
	app.OnRecordUpdate("posts").BindFunc(syncHasPassword)

	// Anonymous requests never receive locked content or the password
	// itself. Authenticated readers (admin/collaborator via cookie/token)
	// keep the full row — the editor preview relies on it.
	app.OnRecordEnrich("posts").BindFunc(func(e *core.RecordEnrichEvent) error {
		if e.RequestInfo != nil && e.RequestInfo.Auth != nil {
			return e.Next()
		}
		if e.Record.GetString("password") != "" {
			e.Record.Set("content", "")
			e.Record.Set("password", "")
		}
		return e.Next()
	})

	// categories.password has no public consumer; anonymous reads never
	// see it. (categories ListRule is public, so the field-level mask is
	// the only barrier.)
	app.OnRecordEnrich("categories").BindFunc(func(e *core.RecordEnrichEvent) error {
		if e.RequestInfo != nil && e.RequestInfo.Auth != nil {
			return e.Next()
		}
		if e.Record.GetString("password") != "" {
			e.Record.Set("password", "")
		}
		return e.Next()
	})
}

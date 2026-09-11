// visibility.go — the named spec for the platform's public post visibility.
//
// There is no single hand-written predicate: the same collection carries
// four deliberate visibility policies (A-D below), and this file owns
// policy B — public artifacts — by deriving it from the collection's own
// rule (the same rule pb enforces for the REST surface) instead of
// copying it.
//
//	A. REST surface (per-request): pb ListRule/ViewRule strings in
//	   pb_migrations — auth-aware, teaser-preserving (locked posts stay
//	   listable with content/password masked by enrich). Enforced by pb at
//	   the API boundary.
//	B. Public artifacts (this file): RSS/Atom, sitemap, timeline, search,
//	   top-posts. No viewer to authenticate and the output is readable by
//	   anyone, so the predicate is the collection's ListRule evaluated
//	   ANONYMOUSLY, plus one delta: password = ''. The delta exists because
//	   the rule's anonymous branch deliberately keeps locked rows (teaser
//	   cards) — artifacts must exclude them entirely. Deriving from the
//	   rule means visibility changes land in the migrations once and every
//	   call site follows automatically; hand-rolled copies are what drifted
//	   in the 2026-09 audit (all four sites missed private=false).
//	C. Admin surfaces (export, trash, editor previews): full fidelity by
//	   design; permission-gated, never routed through here.
//	D. Key resolution (e.g. visits pathname→id): no content leaves the
//	   server; exempt from visibility filters on purpose.
//
// Mechanism note: the predicate is evaluated through the same code path as
// the REST anonymous face — a synthesized RequestInfo with nil Auth and
// empty query/headers/body, exactly the shape core's initRequestInfo
// builds for an anonymous GET. With Auth == nil the resolver binds every
// @request.auth.* to SQL NULL (record_field_resolver_runner.go), so an
// @request.auth.id != "" branch collapses to false. Deriving from the
// REST-shaped struct rather than a convenience wrapper's incidental nil
// handling means pb cannot change these semantics without changing
// its own front door. Rule, delta and caller extra are each compiled
// independently through the same evaluator into dbx expressions and
// AND-composed structurally: search's concatExpr parenthesizes any
// multi-term output and dbx wraps every WHERE fragment in its own parens,
// so precedence cannot leak between the fragments — there is no string
// concatenation left to parenthesize by hand.
// Fail-closed: an unset ListRule would mean pb itself forbids anonymous
// reads, so FindPublicPosts refuses to query too.
//
// The theme's site lists belong to the REST surface (A), not to public
// artifacts (B): upstream shows locked posts as teaser cards there,
// guarded per request by API rules.
package article

import (
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/search"
)

// publicArtifactDelta is the only public-artifact predicate that the
// collection rule cannot express: locked posts are teaser-visible on the
// REST surface by upstream design, but public artifacts have no teaser UI
// to render.
const publicArtifactDelta = "password = ''"

// FindPublicPosts queries posts under the collection's ListRule evaluated
// anonymously (see the file header) plus publicArtifactDelta. extra is an
// optional additional condition, compiled independently and AND-composed
// as a dbx expression so callers can only narrow the derived filter, never
// widen it; params binds its {:placeholders}.
// sort/limit/offset semantics match FindRecordsByFilter: limit <= 0 means
// unlimited (e.g. the sitemap).
func FindPublicPosts(app core.App, extra, sort string, limit, offset int, params dbx.Params) ([]*core.Record, error) {
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		return nil, fmt.Errorf("article: find posts collection: %w", err)
	}
	if col.ListRule == nil || *col.ListRule == "" {
		return nil, fmt.Errorf("article: posts.ListRule is unset; refusing to serve a public surface without a visibility spec")
	}

	// Same shape e.RequestInfo() builds for an anonymous GET
	// (core/event_request.go initRequestInfo): nil Auth, empty
	// query/headers/body maps.
	reqInfo := &core.RequestInfo{
		Context: core.RequestInfoContextDefault,
		Method:  "GET",
		Query:   map[string]string{},
		Headers: map[string]string{},
		Body:    map[string]any{},
	}

	query := app.RecordQuery(col)
	resolver := core.NewRecordFieldResolver(app, col, reqInfo, true)

	// Each predicate compiles through pb's own evaluator into a
	// self-contained dbx.Expression (see the file header): structural
	// composition, no string concatenation, no hand-wrapped parens.
	ruleExpr, err := search.FilterData(*col.ListRule).BuildExpr(resolver, params)
	if err != nil {
		return nil, fmt.Errorf("article: invalid posts.ListRule: %w", err)
	}
	deltaExpr, err := search.FilterData(publicArtifactDelta).BuildExpr(resolver, params)
	if err != nil {
		return nil, fmt.Errorf("article: invalid public artifact delta: %w", err)
	}
	query.AndWhere(ruleExpr)
	query.AndWhere(deltaExpr)

	if extra != "" {
		extraExpr, err := search.FilterData(extra).BuildExpr(resolver, params)
		if err != nil {
			return nil, fmt.Errorf("article: invalid extra filter: %w", err)
		}
		query.AndWhere(extraExpr)
	}
	if sort != "" {
		for _, sortField := range search.ParseSortFromString(sort) {
			sortExpr, sortErr := sortField.BuildExpr(resolver)
			if sortErr != nil {
				return nil, fmt.Errorf("article: invalid sort: %w", sortErr)
			}
			if sortExpr != "" {
				query.AndOrderBy(sortExpr)
			}
		}
	}
	if err := resolver.UpdateQuery(query); err != nil {
		return nil, fmt.Errorf("article: visibility query: %w", err)
	}
	if offset > 0 {
		query.Offset(int64(offset))
	}
	if limit > 0 {
		query.Limit(int64(limit))
	}
	records := []*core.Record{}
	if err := query.All(&records); err != nil {
		return nil, fmt.Errorf("article: visibility query: %w", err)
	}
	return records, nil
}

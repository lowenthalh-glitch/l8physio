// Package auth holds regression tests that lock in client-side security
// invariants. The mobile UI (web/m/) was rewritten in `plans/mobile-security-parity.md`
// to assume that every API endpoint under the web server returns 401 when called
// without a bearer token — these tests assert that property directly so that a
// future change to the request handlers can't silently drop the auth check.
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/saichler/l8web/go/web/server"
)

// TestPermissionsRequiresAuth asserts that the /permissions endpoint — fetched
// at mobile app startup by go/physio/ui/web/m/js/app-core.js via
// Layer8MAuth.get('/permissions') — returns 401 when no Authorization header
// is present. This is the canonical "is the user logged in?" probe and the
// foundation of the mobile UI's session model.
//
// The handler returns 401 before touching the underlying VNic, so we can drive
// it directly with a zero-value WebService — no vnet bring-up required.
func TestPermissionsRequiresAuth(t *testing.T) {
	ws := &server.WebService{}
	req := httptest.NewRequest(http.MethodGet, "/permissions", nil)
	rec := httptest.NewRecorder()

	ws.Permissions(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET /permissions without Authorization: want 401, got %d (body=%q)", rec.Code, rec.Body.String())
	}
}

// TestValidateBearerTokenRejectsMissing asserts the same property on the proxy
// validator path — l8common.CreateWebServer wires this into the reverse-proxy
// validator (see WebService.go:382). A request with no Authorization header
// (and no fallback token in cookie/query) must fail validation. Mobile depends
// on this returning unauthorized so that Layer8MAuth._handleSessionExpired
// triggers a redirect rather than silently rendering a stale page.
func TestValidateBearerTokenRejectsMissing(t *testing.T) {
	ws := &server.WebService{}
	req := httptest.NewRequest(http.MethodGet, "/m/app.html", nil)

	if err := ws.ValidateBearerToken(req); err == nil {
		t.Fatalf("ValidateBearerToken with no Authorization: want error, got nil")
	}
}

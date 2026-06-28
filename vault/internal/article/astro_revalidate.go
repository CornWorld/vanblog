package article

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

// revalidateAstroCache notifies the Astro SSR server to invalidate cached
// pages. Called asynchronously when posts are created/updated/deleted.
//
// ASTRO_URL env overrides the default (host-side Astro dev :4321, or the
// in-container Astro SSR in prod). Non-200 responses are logged but not
// retried — Astro caches are eventually consistent via SWR.
func revalidateAstroCache(tags []string) {
	astroURL := os.Getenv("ASTRO_URL")
	if astroURL == "" {
		astroURL = "http://127.0.0.1:4321"
	}

	body, _ := json.Marshal(map[string][]string{"tags": tags})
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(astroURL+"/api/revalidate", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[article] revalidate: failed to reach Astro at %s: %v", astroURL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[article] revalidate: Astro returned %d", resp.StatusCode)
	} else {
		log.Printf("[article] revalidate: cache invalidated for tags %v", tags)
	}
}

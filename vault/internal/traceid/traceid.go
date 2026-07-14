// Package traceid provides a compact request identifier for correlating
// log entries with HTTP responses. Each request gets a nanosecond-precision
// hex ID stored in the PocketBase event data store (e.Set).
package traceid

import (
	"fmt"
	"time"
)

// Generate returns a compact hex string (~13-16 chars) using nanosecond
// timestamp. Good enough for a single-node blog system.
func Generate() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())
}

//go:build !windows

package screen

import (
	"context"
	"time"
)

// noopProvider implements Provider with no-ops on non-Windows platforms.
type noopProvider struct{}

// New creates a no-op screen capture provider on non-Windows platforms.
func New(context.Context) Provider { return &noopProvider{} }

func (p *noopProvider) Configure(CaptureConfig)      {}
func (p *noopProvider) Start() error                 { return nil }
func (p *noopProvider) Stop()                        {}
func (p *noopProvider) Enabled() bool                { return false }
func (p *noopProvider) Session() (string, time.Time) { return "", time.Time{} }
func (p *noopProvider) Segments(string, time.Time, time.Time, time.Time) ([]string, time.Duration, bool) {
	return nil, 0, false
}
func (p *noopProvider) ReleaseSegments([]string) {}
func (p *noopProvider) ReleaseSession(string)    {}

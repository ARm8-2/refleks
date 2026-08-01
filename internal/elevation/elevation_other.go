//go:build !windows

package elevation

// IsElevated reports whether the current process runs with elevated
// privileges. No-op on non-Windows.
func IsElevated() bool { return false }

// RelaunchUnelevated restarts the current executable with a normal token.
// No-op on non-Windows.
func RelaunchUnelevated() error { return nil }

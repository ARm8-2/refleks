//go:build !windows

package process

// IsRunning reports whether a process with the given executable name exists.
// Probe errors are returned separately from a process that is not running.
func IsRunning(_ string) (bool, error) {
	return false, nil
}

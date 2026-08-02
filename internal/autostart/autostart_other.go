//go:build !windows

package autostart

// Enable registers the application to start on login. No-op on non-Windows.
func (s *Service) Enable(args string) error {
	return nil
}

// Disable removes the autostart registration. No-op on non-Windows.
func (s *Service) Disable() error {
	return nil
}

// IsEnabled reports whether autostart is registered. No-op on non-Windows.
func (s *Service) IsEnabled() (bool, error) {
	return false, nil
}

// Sync reconciles the autostart registration with the desired state.
// No-op on non-Windows.
func (s *Service) Sync(enabled bool, args string) error {
	return nil
}

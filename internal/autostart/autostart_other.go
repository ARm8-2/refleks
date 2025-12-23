//go:build !windows

package autostart

func (s *Service) Enable(args string) error {
	return nil
}

func (s *Service) Disable() error {
	return nil
}

func (s *Service) IsEnabled() (bool, error) {
	return false, nil
}

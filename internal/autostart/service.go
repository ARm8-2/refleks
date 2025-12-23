package autostart

// Service handles the registration of the application to start automatically on login.
type Service struct{}

func NewService() *Service {
	return &Service{}
}

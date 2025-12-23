//go:build !windows

package process

func isRunning(_ string) bool {
	return false
}

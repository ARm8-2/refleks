//go:build !windows

package process

func processIsRunning(_ string) bool {
	return false
}

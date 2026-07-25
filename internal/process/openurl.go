// Package process provides process monitoring and OS-level utilities.

package process

// OpenURL opens the given URL with the system's default handler.
// On Windows this routes through ShellExecute, which properly handles
// registered custom protocol schemes (e.g. steam://). Non-Windows
// platforms fall back to xdg-open / open.
func OpenURL(url string) error {
	return openURL(url)
}

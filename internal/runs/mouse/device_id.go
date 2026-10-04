package mouse

import (
	"regexp"
	"strings"
)

var (
	vidRegex = regexp.MustCompile(`(?i)VID_([0-9A-F]{4})(?:[^0-9A-F]|$)`)
	pidRegex = regexp.MustCompile(`(?i)PID_([0-9A-F]{4})(?:[^0-9A-F]|$)`)
	miRegex  = regexp.MustCompile(`(?i)MI_([0-9A-F]{2})(?:[^0-9A-F]|$)`)
)

func parseVIDPIDMI(deviceName string) (string, string, string) {
	vid := ""
	pid := ""
	mi := ""
	if m := vidRegex.FindStringSubmatch(deviceName); len(m) == 2 {
		vid = strings.ToUpper(m[1])
	}
	if m := pidRegex.FindStringSubmatch(deviceName); len(m) == 2 {
		pid = strings.ToUpper(m[1])
	}
	if m := miRegex.FindStringSubmatch(deviceName); len(m) == 2 {
		mi = strings.ToUpper(m[1])
	}
	return vid, pid, mi
}

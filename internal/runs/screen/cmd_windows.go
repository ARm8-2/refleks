//go:build windows

package screen

import (
	"os/exec"
	"syscall"
)

// hideCmdWindow configures the subprocess to not create a console window.
// On Windows, ffmpeg.exe is a console-mode binary; spawning it from a GUI
// app without this flag flashes a terminal window.
func hideCmdWindow(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	// CREATE_NO_WINDOW (0x08000000) + BELOW_NORMAL_PRIORITY_CLASS (0x00004000)
	cmd.SysProcAttr.CreationFlags |= 0x08000000 | 0x00004000
}

package mouse

import "testing"

func TestParseVIDPIDMI(t *testing.T) {
	for _, tt := range []struct {
		name             string
		deviceName       string
		wantVID, wantPID string
		wantMI           string
	}{
		{
			name:       "Windows HID path with mixed-case IDs",
			deviceName: `\\?\HID#vid_046d&pid_c539&mi_01#7&2a3b4c5d&0&0000`,
			wantVID:    "046D", wantPID: "C539", wantMI: "01",
		},
		{
			name:       "VID and PID without interface number",
			deviceName: `HID#VID_1234&PID_ABCD#instance`,
			wantVID:    "1234", wantPID: "ABCD",
		},
		{
			name:       "partial identifiers",
			deviceName: `HID#VID_1a2b&PID_xyz&MI_02`,
			wantVID:    "1A2B", wantMI: "02",
		},
		{
			name:       "malformed identifier lengths",
			deviceName: `HID#VID_123&PID_ABCDE&MI_1`,
		},
		{name: "unrelated device path", deviceName: `HID#ROOT_MOUSE#instance`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			vid, pid, mi := parseVIDPIDMI(tt.deviceName)
			if vid != tt.wantVID || pid != tt.wantPID || mi != tt.wantMI {
				t.Errorf("parseVIDPIDMI(%q) = (%q, %q, %q), want (%q, %q, %q)",
					tt.deviceName, vid, pid, mi, tt.wantVID, tt.wantPID, tt.wantMI)
			}
		})
	}
}

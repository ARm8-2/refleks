package models

import "time"

type ScenarioRecord struct {
	FilePath string         `json:"filePath"`
	FileName string         `json:"fileName"`
	Stats    map[string]any `json:"stats"`
	Events   [][]string     `json:"events"`
	// Optional mouse trace captured locally. Absent when disabled or unavailable.
	MouseTrace []MousePoint `json:"mouseTrace,omitempty"`
}

type MousePoint struct {
	TS time.Time `json:"ts"`
	X  int32     `json:"x"`
	Y  int32     `json:"y"`
	// Buttons is a bitmask representing which mouse buttons are currently held down.
	// Bits: 1=Left, 2=Right, 4=Middle, 8=Button4, 16=Button5
	Buttons int32 `json:"buttons,omitempty"`
}

package models

import "time"

type WatcherConfig struct {
	Path                 string
	SessionGap           time.Duration
	PollInterval         time.Duration
	ParseExistingOnStart bool
	ParseExistingLimit   int
}

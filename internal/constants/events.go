package constants

// Event names used for runtime.EventsEmit
const (
	// Update events
	EventUpdateAvailable = "update:available"

	// Benchmark events
	EventBenchmarkProgressUpdated = "benchmark:progress:updated"
	EventBenchmarkProgressPrefix  = "benchmark:progress:" // + benchmarkId

	// Watcher/Scenario events
	EventWatcherStarted  = "watcher:started"
	EventScenarioAdded   = "scenario:added"
	EventScenarioUpdated = "scenario:updated"
)

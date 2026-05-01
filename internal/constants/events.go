package constants

// Event names used for runtime.EventsEmit
const (
	// Update events
	EventUpdateAvailable = "update:available"

	// Benchmark events
	EventBenchmarkProgressUpdated = "benchmark:progress:updated"
	EventBenchmarkProgressPrefix  = "benchmark:progress:" // + benchmarkId
	EventBenchmarkCatalogUpdated  = "benchmark:catalog:updated"

	// Runs events
	EventRunsWatcherStarted = "runs:watcher:started"
	EventRunsAdded          = "runs:added"
)

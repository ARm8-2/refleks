package runs

import (
	"path/filepath"
	"time"

	"refleks/internal/models"
	"refleks/internal/runs/environment"
)

// IngestScenario parses a KovaaK's stats CSV, enriches it, persists it, and returns the stored record.
func (s *Store) IngestScenario(fullPath string, mouse models.MouseTraceProvider) (models.ScenarioRecord, error) {
	info, err := ParseFilename(filepath.Base(fullPath))
	if err != nil {
		return models.ScenarioRecord{}, err
	}
	events, stats, err := ParseStatsFile(fullPath)
	if err != nil {
		return models.ScenarioRecord{}, err
	}

	stats["Date Played"] = info.DatePlayed.Format(time.RFC3339)

	var hit, miss float64
	if v, ok := stats["Hit Count"]; ok {
		hit = toFloat(v)
	}
	if v, ok := stats["Miss Count"]; ok {
		miss = toFloat(v)
	}
	if denom := hit + miss; denom > 0 {
		stats["Accuracy"] = hit / denom
	} else {
		stats["Accuracy"] = 0.0
	}

	if len(events) >= 2 {
		var times []time.Time
		for _, row := range events {
			if len(row) < 2 {
				continue
			}
			if t, ok := parseTODOnDate(row[1], info.DatePlayed); ok {
				times = append(times, t)
			}
		}
		if len(times) >= 2 {
			var sum time.Duration
			for i := 1; i < len(times); i++ {
				if dt := times[i].Sub(times[i-1]); dt > 0 {
					sum += dt
				}
			}
			if intervals := len(times) - 1; intervals > 0 {
				stats["Real Avg TTK"] = sum.Seconds() / float64(intervals)
			}
		}
	}

	if cm, ok := cm360FromStats(stats); ok {
		stats["cm/360"] = cm
	}

	start, end := deriveScenarioWindow(info.DatePlayed, stats, events)
	if !start.IsZero() && !end.IsZero() {
		stats["Duration"] = end.Sub(start).Seconds()
	}

	rec := models.ScenarioRecord{
		FilePath: fullPath,
		FileName: filepath.Base(fullPath),
		Stats:    stats,
		Events:   events,
	}

	var trace []models.MousePoint
	if mouse != nil && mouse.Enabled() {
		if !start.IsZero() && !end.IsZero() && start.Before(end) {
			trace = mouse.GetRange(start, end)
		}
	}

	runPath, err := s.Save(RunRecord{
		FileName:   rec.FileName,
		Stats:      rec.Stats,
		Events:     rec.Events,
		MouseTrace: trace,
		Env:        environment.CollectRunEnvironment(mouse, start, end, len(trace)),
	})
	if err != nil {
		return models.ScenarioRecord{}, err
	}

	rec.FilePath = runPath
	rec.HasTrace = len(trace) > 0
	return rec, nil
}

// deriveScenarioWindow attempts to compute the [start, end] timespan of a scenario.
func deriveScenarioWindow(end time.Time, stats map[string]any, events [][]string) (time.Time, time.Time) {
	var start time.Time
	if v, ok := stats["Challenge Start"]; ok {
		if s, ok := v.(string); ok {
			if t, ok := parseTODOnDate(s, end); ok {
				start = t
			}
		}
	}
	if start.IsZero() && len(events) > 0 && len(events[0]) > 1 {
		if t, ok := parseTODOnDate(events[0][1], end); ok {
			start = t
		}
	}
	if start.IsZero() {
		start = end.Add(-60 * time.Second)
	}
	if start.After(end) {
		start = start.AddDate(0, 0, -1)
	}
	return start, end
}

// parseTODOnDate parses a clock time string onto the provided date.
func parseTODOnDate(s string, date time.Time) (time.Time, bool) {
	layouts := []string{
		"15:04:05.000000",
		"15:04:05.000",
		"15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return time.Date(date.Year(), date.Month(), date.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), date.Location()), true
		}
	}
	return time.Time{}, false
}

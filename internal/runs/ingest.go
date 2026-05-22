package runs

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/environment"
	"refleks/internal/steam"
)

// IngestRun parses a KovaaK's stats CSV, enriches it, persists it, and returns the stored record.
func (s *Store) IngestRun(fullPath string, mouse models.MouseTraceProvider) (models.RunRecord, error) {
	info, err := ParseFilename(filepath.Base(fullPath))
	if err != nil {
		return models.RunRecord{}, err
	}
	statsEvents, stats, err := ParseStatsFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
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

	if len(statsEvents) >= 2 {
		var times []time.Time
		for _, row := range statsEvents {
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

	start, end := deriveScenarioWindow(info.DatePlayed, stats, statsEvents)
	if !start.IsZero() && !end.IsZero() {
		stats["Duration"] = end.Sub(start).Seconds()
	}

	fileName := runFileNameFromStatsPath(fullPath)
	performanceData, err := parseMatchingPerformanceFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
	}
	normalizedStats := withStatsEvents(stats, statsEvents)

	rec := models.RunRecord{
		FileVersion:  runVersionCurrent,
		FilePath:     fullPath,
		FileName:     fileName,
		Stats:        normalizedStats,
		Performances: performanceData,
	}

	var steamID, personaName string
	if s.settingsSvc != nil {
		settings := s.settingsSvc.Get()
		steamID = steam.GetSteamID(settings)
		personaName = steam.GetPersonaName(settings)
	}

	var trace []models.MousePoint
	if mouse != nil && mouse.Enabled() {
		if !start.IsZero() && !end.IsZero() && start.Before(end) {
			trace = mouse.GetRange(start, end)
		}
	}

	runPath, err := s.Save(storedRunRecord{
		FileVersion:  runVersionCurrent,
		FileName:     rec.FileName,
		EpochMilli:   info.DatePlayed.UnixMilli(),
		Stats:        rec.Stats,
		Performances: rec.Performances,
		MouseTrace:   trace,
		Env:          environment.CollectRunEnvironment(mouse, start, end, len(trace), steamID, personaName),
	})
	if err != nil {
		return models.RunRecord{}, err
	}

	rec.FilePath = runPath
	return rec, nil
}

func parseMatchingPerformanceFile(statsPath string) (*models.RunPerformanceData, error) {
	perfPath := matchingPerformancePath(statsPath)
	if _, err := os.Stat(perfPath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return ParsePerformanceFile(perfPath)
}

func matchingPerformancePath(statsPath string) string {
	return filepath.Join(filepath.Dir(filepath.Dir(statsPath)), constants.KovaaksPerformancesDirName, performanceFileNameFromStatsPath(statsPath))
}

func runFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats")
}

func performanceFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats") + " Performance" + constants.PerformanceFileExt
}

// deriveScenarioWindow attempts to compute the [start, end] timespan of a scenario.
func deriveScenarioWindow(end time.Time, stats map[string]any, statsEvents [][]string) (time.Time, time.Time) {
	var start time.Time
	if v, ok := stats["Challenge Start"]; ok {
		if s, ok := v.(string); ok {
			if t, ok := parseTODOnDate(s, end); ok {
				start = t
			}
		}
	}
	if start.IsZero() && len(statsEvents) > 0 && len(statsEvents[0]) > 1 {
		if t, ok := parseTODOnDate(statsEvents[0][1], end); ok {
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

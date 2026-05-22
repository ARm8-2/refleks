package runs

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/environment"
	"refleks/internal/runs/kovaaks"
	"refleks/internal/steam"
)

// IngestRun parses a KovaaK's stats CSV, enriches it, persists it, and returns the stored record.
func (s *Store) IngestRun(fullPath string, mouse models.MouseTraceProvider) (models.RunRecord, error) {
	info, err := kovaaks.ParseFilename(filepath.Base(fullPath))
	if err != nil {
		return models.RunRecord{}, err
	}
	stats, err := kovaaks.ParseStatsFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
	}

	stats.Summary.DatePlayed = info.DatePlayed.Format(time.RFC3339)

	hit := float64(stats.Summary.HitCount)
	miss := float64(stats.Summary.MissCount)
	if denom := hit + miss; denom > 0 {
		stats.Summary.Accuracy = hit / denom
	} else {
		stats.Summary.Accuracy = 0
	}

	if len(stats.Events) >= 2 {
		var times []time.Time
		for _, event := range stats.Events {
			if t, ok := parseTODOnDate(event.Timestamp, info.DatePlayed); ok {
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
				stats.Summary.RealAvgTTK = sum.Seconds() / float64(intervals)
			}
		}
	}

	if cm, ok := cm360FromStats(stats.Summary); ok {
		stats.Summary.Cm360 = cm
	}

	start, end := deriveScenarioWindow(info.DatePlayed, stats.Summary, stats.Events)
	if !start.IsZero() && !end.IsZero() {
		stats.Summary.Duration = end.Sub(start).Seconds()
	}

	fileName := runFileNameFromStatsPath(fullPath)
	performanceData, err := parseMatchingPerformancesFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
	}

	rec := models.RunRecord{
		FileVersion:  runVersionCurrent,
		FilePath:     fullPath,
		FileName:     fileName,
		Stats:        stats,
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

func parseMatchingPerformancesFile(statsPath string) (*models.RunPerformanceData, error) {
	perfPath := matchingPerformancesPath(statsPath)
	if _, err := os.Stat(perfPath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return kovaaks.ParsePerformancesFile(perfPath)
}

func matchingPerformancesPath(statsPath string) string {
	return filepath.Join(filepath.Dir(filepath.Dir(statsPath)), constants.KovaaksPerformancesDirName, performancesFileNameFromStatsPath(statsPath))
}

func runFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats")
}

func performancesFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats") + " Performance" + constants.PerformanceFileExt
}

// deriveScenarioWindow attempts to compute the [start, end] timespan of a scenario.
func deriveScenarioWindow(end time.Time, stats models.RunStatsSummary, statsEvents []models.RunStatsEvent) (time.Time, time.Time) {
	var start time.Time
	if challengeStart := stats.ChallengeStart; challengeStart != "" {
		if t, ok := parseTODOnDate(challengeStart, end); ok {
			start = t
		}
	}
	if start.IsZero() && len(statsEvents) > 0 {
		if t, ok := parseTODOnDate(statsEvents[0].Timestamp, end); ok {
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

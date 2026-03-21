package runs

import (
	"encoding/binary"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// Store manages the .refleks run directory.
type Store struct {
	settingsSvc *appsettings.Service
}

// NewStore constructs a run store.
func NewStore(settingsSvc *appsettings.Service) *Store {
	return &Store{settingsSvc: settingsSvc}
}

func (s *Store) runsDir() (string, error) {
	base, err := appsettings.GetConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, constants.RunsSubdirName)

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func toRunFileName(statsFileName string) string {
	name := filepath.Base(statsFileName)
	if strings.HasSuffix(strings.ToLower(name), ".refleks") {
		return name
	}
	ext := filepath.Ext(name)
	if ext != "" {
		name = strings.TrimSuffix(name, ext)
	}
	return name + ".refleks"
}

// Exists reports whether the given stats file already has a stored run record.
func (s *Store) Exists(statsFileName string) bool {
	dir, err := s.runsDir()
	if err != nil {
		return false
	}
	_, err = os.Stat(filepath.Join(dir, toRunFileName(statsFileName)))
	return err == nil
}

// Save persists a run record to disk and returns its final file path.
func (s *Store) Save(rec RunRecord) (string, error) {
	if strings.TrimSpace(rec.FileName) == "" {
		return "", errors.New("missing file name")
	}

	dir, err := s.runsDir()
	if err != nil {
		return "", err
	}

	outPath := filepath.Join(dir, toRunFileName(rec.FileName))
	tmpPath := outPath + ".tmp"

	f, err := os.Create(tmpPath)
	if err != nil {
		return "", err
	}

	writeErr := writeRecord(f, rec)
	closeErr := f.Close()
	if writeErr != nil {
		_ = os.Remove(tmpPath)
		return "", writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return "", closeErr
	}

	if err := os.Rename(tmpPath, outPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", err
	}

	return outPath, nil
}

// LoadByFileName loads a stored run record for the provided stats file name.
func (s *Store) LoadByFileName(statsFileName string) (RunRecord, error) {
	dir, err := s.runsDir()
	if err != nil {
		return RunRecord{}, err
	}

	path := filepath.Join(dir, toRunFileName(statsFileName))
	rec, err := readRecordFile(path)
	if err != nil {
		return RunRecord{}, err
	}
	rec.FilePath = path
	return rec, nil
}

// LoadRecentScenarios returns recent scenarios in oldest-to-newest order.
func (s *Store) LoadRecentScenarios(limit int) ([]models.ScenarioRecord, error) {
	records, err := s.LoadRecent(limit)
	if err != nil {
		return nil, err
	}

	out := make([]models.ScenarioRecord, 0, len(records))
	for _, r := range records {
		out = append(out, models.ScenarioRecord{
			FilePath: r.FilePath,
			FileName: r.FileName,
			Stats:    r.Stats,
			Events:   r.Events,
			Env:      r.Env,
			HasTrace: len(r.MouseTrace) > 0,
		})
	}
	return out, nil
}

// LoadRecent returns up to limit records sorted oldest-to-newest.
func (s *Store) LoadRecent(limit int) ([]RunRecord, error) {
	dir, err := s.runsDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	type wrapped struct {
		path string
		name string
		ts   int64
	}
	all := make([]wrapped, 0, len(entries))

	days := constants.DefaultRecentRunsDays
	minCount := constants.DefaultRecentRunsMinCount
	if s.settingsSvc != nil {
		cfg := s.settingsSvc.Get()
		if configured := cfg.RecentRunsDays; configured > 0 {
			days = configured
		}
		if configured := cfg.RecentRunsMinCount; configured > 0 {
			minCount = configured
		}
	}
	var cutoff int64
	if days > 0 {
		cutoff = time.Now().AddDate(0, 0, -days).UnixMilli()
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(e.Name()), ".refleks") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		ts := scenarioTimestampFromFileName(e.Name(), path)
		all = append(all, wrapped{path: path, name: e.Name(), ts: ts})
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].ts == all[j].ts {
			return all[i].name < all[j].name
		}
		return all[i].ts < all[j].ts
	})

	selectedStart := 0
	if cutoff > 0 {
		selectedStart = len(all)
		for i := len(all) - 1; i >= 0; i-- {
			if all[i].ts >= cutoff {
				selectedStart = i
			} else {
				break
			}
		}

		if minCount > 0 {
			minStart := len(all) - minCount
			if minStart < 0 {
				minStart = 0
			}
			if minStart < selectedStart {
				selectedStart = minStart
			}
		}

		if selectedStart > len(all) {
			selectedStart = len(all)
		}
	}

	selected := all[selectedStart:]
	if limit > 0 && len(selected) > limit {
		selected = selected[len(selected)-limit:]
	}

	out := make([]RunRecord, 0, len(selected))
	for _, v := range selected {
		rec, err := readRecordFile(v.path)
		if err != nil {
			continue
		}
		rec.FilePath = v.path
		out = append(out, rec)
	}
	return out, nil
}

func scenarioTimestampFromFileName(fileName, path string) int64 {
	if ts, ok := runEpochFromFile(path); ok {
		return ts
	}

	base := strings.TrimSuffix(fileName, ".refleks") + ".csv"
	if info, err := ParseFilename(base); err == nil {
		return info.DatePlayed.UnixMilli()
	}
	if fi, err := os.Stat(path); err == nil {
		return fi.ModTime().UnixMilli()
	}
	return 0
}

func runEpochFromFile(path string) (int64, bool) {
	f, err := os.Open(path)
	if err != nil {
		return 0, false
	}
	defer f.Close()

	var magic [4]byte
	if _, err := io.ReadFull(f, magic[:]); err != nil {
		return 0, false
	}
	if string(magic[:]) != runMagic {
		return 0, false
	}

	var version uint8
	if err := binary.Read(f, binary.LittleEndian, &version); err != nil {
		return 0, false
	}
	if version != runVersion {
		return 0, false
	}

	var compression uint8
	if err := binary.Read(f, binary.LittleEndian, &compression); err != nil {
		return 0, false
	}
	_ = compression

	var epochMilli int64
	if err := binary.Read(f, binary.LittleEndian, &epochMilli); err != nil {
		return 0, false
	}
	if epochMilli <= 0 {
		return 0, false
	}
	return epochMilli, true
}

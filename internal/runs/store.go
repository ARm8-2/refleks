package runs

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// Store manages the .refleks run directory.
type Store struct{}

// NewStore constructs a run store.
func NewStore() *Store {
	return &Store{}
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

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(e.Name()), ".refleks") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		all = append(all, wrapped{path: path, name: e.Name(), ts: scenarioTimestampFromFileName(e.Name(), path)})
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].ts == all[j].ts {
			return all[i].name < all[j].name
		}
		return all[i].ts < all[j].ts
	})

	if limit > 0 && len(all) > limit {
		all = all[len(all)-limit:]
	}

	out := make([]RunRecord, 0, len(all))
	for _, v := range all {
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
	base := strings.TrimSuffix(fileName, ".refleks") + ".csv"
	if info, err := ParseFilename(base); err == nil {
		return info.DatePlayed.UnixMilli()
	}
	if fi, err := os.Stat(path); err == nil {
		return fi.ModTime().UnixMilli()
	}
	return 0
}

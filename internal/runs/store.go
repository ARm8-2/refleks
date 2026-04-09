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

// Exists reports whether the given stats file already has a stored run record.
func (s *Store) Exists(statsFileName string) bool {
	dir, err := s.runsDir()
	if err != nil {
		return false
	}
	statsName := filepath.Base(statsFileName)
	runName := strings.TrimSuffix(statsName, constants.StatsFileExt) + constants.RunFileExt
	_, err = os.Stat(filepath.Join(dir, runName))
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

	outPath := filepath.Join(dir, filepath.Base(rec.FileName)+constants.RunFileExt)
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

// LoadRunEvents reads a single .refleks file by full path and returns its kill events.
func (s *Store) LoadRunEvents(filePath string) ([][]string, error) {
	rec, err := readRecordFile(filePath, readRecordOptions{})
	if err != nil {
		return nil, err
	}
	if rec.Events == nil {
		return [][]string{}, nil
	}
	return rec.Events, nil
}

// LoadRunTrace reads a single .refleks file by full path and returns its mouse
// trace encoded in the frontend wire format.
func (s *Store) LoadRunTrace(filePath string) (string, error) {
	rec, err := readRecordFile(filePath, readRecordOptions{})
	if err != nil {
		return "", err
	}
	if rec.MouseTrace == nil {
		return "", nil
	}
	if len(rec.MouseTrace) == 0 {
		return "", nil
	}

	return EncodeTraceBase64(rec.MouseTrace)
}

// LoadRecentRuns returns recent runs in oldest-to-newest order.
// Events are omitted to save memory; use LoadRunEvents for on-demand event access.
func (s *Store) LoadRecentRuns(limit int) ([]models.RunRecord, error) {
	selected, err := s.selectRecentFiles(limit)
	if err != nil {
		return nil, err
	}

	out := make([]models.RunRecord, 0, len(selected))
	for _, v := range selected {
		rec, err := readRecordFile(v.path, readRecordOptions{skipEvents: true, skipMouseTrace: true})
		if err != nil {
			continue
		}
		out = append(out, models.RunRecord{
			FilePath: v.path,
			FileName: rec.FileName,
			Stats:    rec.Stats,
			Events:   nil,
			Env:      rec.Env,
		})
	}
	return out, nil
}

type recentFile struct {
	path string
	name string
	ts   int64
}

// selectRecentFiles returns the file paths to load, sorted oldest-to-newest.
func (s *Store) selectRecentFiles(limit int) ([]recentFile, error) {
	dir, err := s.runsDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	all := make([]recentFile, 0, len(entries))

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
		if !strings.HasSuffix(strings.ToLower(e.Name()), constants.RunFileExt) {
			continue
		}

		path := filepath.Join(dir, e.Name())
		ts := runTimestampFromFileName(e.Name(), path)
		all = append(all, recentFile{path: path, name: e.Name(), ts: ts})
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

	return selected, nil
}

func runTimestampFromFileName(fileName, path string) int64 {
	if ts, ok := runEpochFromFile(path); ok {
		return ts
	}

	base := strings.TrimSuffix(fileName, constants.RunFileExt) + constants.StatsFileExt
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

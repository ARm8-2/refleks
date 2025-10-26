package parser

import (
	"bufio"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	// Example: "Air Tracking 180 - Challenge - 2025.09.09-16.57.00 Stats.csv"
	filenameRe = regexp.MustCompile(`^(?P<name>.+?)\s-\s.*?-\s(?P<dt>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\sStats\.csv$`)
	dtLayout   = "2006.01.02-15.04.05"
)

// FilenameInfo represents parsed info from a stats filename.
type FilenameInfo struct {
	ScenarioName string
	DatePlayed   time.Time
}

// ParseFilename extracts scenario name and timestamp from a Kovaak's stats filename.
func ParseFilename(filename string) (FilenameInfo, error) {
	base := filepath.Base(filename)
	m := filenameRe.FindStringSubmatch(base)
	if m == nil {
		return FilenameInfo{}, fmt.Errorf("filename did not match expected format: %s", base)
	}
	name := m[1]
	dtStr := m[2]
	t, err := time.ParseInLocation(dtLayout, dtStr, time.Local)
	if err != nil {
		return FilenameInfo{}, err
	}
	return FilenameInfo{ScenarioName: name, DatePlayed: t}, nil
}

// ParseStatsFile parses a Kovaak's CSV stats file into events and stats map.
// The file format contains a CSV section (events/kill rows) followed by a key-value section separated by ":,".
func ParseStatsFile(path string) (events [][]string, stats map[string]any, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	// We'll read line by line to detect the transition from CSV to key-value section.
	r := bufio.NewReader(f)
	var csvLines [][]string
	var kvLines []string
	isKV := false

	for {
		line, readErr := r.ReadString('\n')
		if errors.Is(readErr, io.EOF) {
			if len(line) > 0 {
				// process last line
			} else {
				break
			}
		} else if readErr != nil {
			return nil, nil, readErr
		}
		trimmed := strings.TrimRight(line, "\r\n")
		if len(trimmed) == 0 {
			// skip pure empty lines but preserve section state
			continue
		}

		// Heuristic: key-value lines contain ":," separator; CSV lines are comma-separated values
		if !isKV && strings.Contains(trimmed, ":,") {
			isKV = true
		}
		if isKV {
			kvLines = append(kvLines, trimmed)
		} else {
			// Accumulate CSV raw line to be parsed via encoding/csv for robustness
			// Use a temporary csv.Reader
			rec, perr := parseCSVLine(trimmed)
			if perr != nil {
				return nil, nil, perr
			}
			// Only keep per-kill event rows. Kovaak's files may contain additional CSV tables
			// (e.g., weapon summary) that should not be included in the events. We treat a row
			// as an event when the first column is a numeric kill index and (optionally) the
			// second column looks like a time-of-day.
			if isKillEventRow(rec) {
				csvLines = append(csvLines, rec)
			}
			// Otherwise, ignore non-event CSV rows (headers, summaries, etc.).
		}
	}

	// Parse kv lines into a map[string]any
	statsMap := make(map[string]any, len(kvLines))
	for _, l := range kvLines {
		parts := strings.SplitN(l, ":,", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Try to coerce to int or float if applicable; otherwise keep as string
		if i, ierr := strconv.Atoi(val); ierr == nil {
			statsMap[key] = i
			continue
		}
		if f, ferr := strconv.ParseFloat(val, 64); ferr == nil {
			statsMap[key] = f
			continue
		}
		statsMap[key] = val
	}

	return csvLines, statsMap, nil
}

func parseCSVLine(line string) ([]string, error) {
	r := csv.NewReader(strings.NewReader(line))
	r.TrimLeadingSpace = true
	r.FieldsPerRecord = -1
	rec, err := r.Read()
	if err != nil {
		return nil, err
	}
	return rec, nil
}

func isInt(s string) bool {
	_, err := strconv.Atoi(strings.TrimSpace(s))
	return err == nil
}

// isKillEventRow returns true if the CSV record appears to be a per-kill event row.
// Expectation: first field is an integer index, second field is a time-of-day like 17:56:30.198
func isKillEventRow(rec []string) bool {
	if len(rec) < 2 {
		return false
	}
	if !isInt(rec[0]) {
		return false
	}
	// Optional sanity check: time-of-day in HH:MM:SS(.fraction)?
	s := strings.TrimSpace(rec[1])
	if len(s) < 7 { // too short to be HH:MM:SS
		return false
	}
	// Fast path without regex: check separators and digits
	// HH:MM:SS prefix
	if len(s) < 8 {
		return false
	}
	if !(s[2] == ':' && s[5] == ':') {
		return false
	}
	for i, ch := range []byte{s[0], s[1], s[3], s[4], s[6], s[7]} {
		if ch < '0' || ch > '9' {
			_ = i
			return false
		}
	}
	// Optional fractional seconds allowed but not required
	return true
}

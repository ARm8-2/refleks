package runs

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

	"refleks/internal/constants"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

var (
	filenameRe = regexp.MustCompile(
		`^(?P<name>.+?)\s-\s.*?-\s(?P<dt>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\sStats` + regexp.QuoteMeta(constants.StatsFileExt) + `$`,
	)
	dtLayout = "2006.01.02-15.04.05"
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
func ParseStatsFile(path string) (events [][]string, stats map[string]any, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	wrapped, werr := wrapReaderWithUTF8(f)
	if werr != nil {
		return nil, nil, werr
	}

	r := bufio.NewReader(wrapped)
	var csvLines [][]string
	var kvLines []string
	isKV := false

	for {
		line, readErr := r.ReadString('\n')
		if errors.Is(readErr, io.EOF) {
			if len(line) == 0 {
				break
			}
		} else if readErr != nil {
			return nil, nil, readErr
		}
		trimmed := strings.TrimRight(line, "\r\n")
		if len(trimmed) == 0 {
			if errors.Is(readErr, io.EOF) {
				break
			}
			continue
		}

		if !isKV && strings.Contains(trimmed, ":,") {
			isKV = true
		}
		if isKV {
			kvLines = append(kvLines, trimmed)
		} else {
			rec, perr := parseCSVLine(trimmed)
			if perr != nil {
				return nil, nil, perr
			}
			if isKillEventRow(rec) {
				csvLines = append(csvLines, rec)
			}
		}

		if errors.Is(readErr, io.EOF) {
			break
		}
	}

	statsMap := make(map[string]any, len(kvLines))
	for _, l := range kvLines {
		parts := strings.SplitN(l, ":,", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if i, ierr := strconv.Atoi(val); ierr == nil {
			statsMap[key] = i
			continue
		}
		if fval, ferr := strconv.ParseFloat(val, 64); ferr == nil {
			statsMap[key] = fval
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

func isKillEventRow(rec []string) bool {
	if len(rec) < 2 {
		return false
	}
	if !isInt(rec[0]) {
		return false
	}
	s := strings.TrimSpace(rec[1])
	if len(s) < 7 {
		return false
	}
	if len(s) < 8 {
		return false
	}
	if !(s[2] == ':' && s[5] == ':') {
		return false
	}
	for _, ch := range []byte{s[0], s[1], s[3], s[4], s[6], s[7]} {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func wrapReaderWithUTF8(r io.Reader) (io.Reader, error) {
	br := bufio.NewReader(r)

	b, _ := br.Peek(3)
	if len(b) >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF {
		_, _ = br.Discard(3)
		return br, nil
	}
	if len(b) >= 2 {
		if b[0] == 0xFF && b[1] == 0xFE {
			_, _ = br.Discard(2)
			return transform.NewReader(br, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
		if b[0] == 0xFE && b[1] == 0xFF {
			_, _ = br.Discard(2)
			return transform.NewReader(br, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
	}

	peek, _ := br.Peek(512)
	if len(peek) > 0 {
		countEven := 0
		countOdd := 0
		for i := 0; i < len(peek); i++ {
			if peek[i] == 0 {
				if i%2 == 0 {
					countEven++
				} else {
					countOdd++
				}
			}
		}
		if countEven+countOdd > len(peek)/8 {
			little := countOdd > countEven
			if little {
				return transform.NewReader(br, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
			}
			return transform.NewReader(br, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
	}

	return br, nil
}

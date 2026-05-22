package runs

import (
	"bufio"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
	"google.golang.org/protobuf/encoding/protowire"
)

const kovaaksFilenamePatternPrefix = `^(?P<name>.+?)\s-\s.*?-\s(?P<dt>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})`

var (
	statsFilenameRe = regexp.MustCompile(
		kovaaksFilenamePatternPrefix + `\sStats` + regexp.QuoteMeta(constants.StatsFileExt) + `$`,
	)
	performanceFilenameRe = regexp.MustCompile(
		kovaaksFilenamePatternPrefix + `\sPerformance` + regexp.QuoteMeta(constants.PerformanceFileExt) + `$`,
	)
	runFilenameRe = regexp.MustCompile(
		kovaaksFilenamePatternPrefix + `(?:\sStats)?` + regexp.QuoteMeta(constants.RunFileExt) + `$`,
	)
	dtLayout = "2006.01.02-15.04.05"
)

// FilenameInfo represents parsed info from a stats filename.
type FilenameInfo struct {
	ScenarioName string
	DatePlayed   time.Time
}

// ParseFilename extracts scenario name and timestamp from a Kovaak's exported
// stats/performance filename or a stored .refleks run filename.
func ParseFilename(filename string) (FilenameInfo, error) {
	base := filepath.Base(filename)
	var m []string
	for _, re := range []*regexp.Regexp{statsFilenameRe, performanceFilenameRe, runFilenameRe} {
		m = re.FindStringSubmatch(base)
		if m != nil {
			break
		}
	}
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
// ParseStatsFile parses a Kovaak's CSV stats file into stats events and a stats map.
func ParseStatsFile(path string) (statsEvents [][]string, stats map[string]any, err error) {
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

func ParsePerformanceFile(path string) (*models.RunPerformanceData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	parsed, err := parsePerformanceMessage(data)
	if err != nil {
		return nil, fmt.Errorf("parse performance file %s: %w", path, err)
	}
	return parsed, nil
}

func parsePerformanceMessage(data []byte) (*models.RunPerformanceData, error) {
	result := &models.RunPerformanceData{}
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return nil, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			header, err := parsePerformanceHeader(msg)
			if err != nil {
				return nil, err
			}
			result.Header = header
			data = data[n:]
		case 2:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			event, err := parsePerformanceEvent(msg)
			if err != nil {
				return nil, err
			}
			result.Events = append(result.Events, event)
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return result, nil
}

func parsePerformanceHeader(data []byte) (models.RunPerformanceHeader, error) {
	var header models.RunPerformanceHeader
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return header, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ScenarioName = value
			data = data[n:]
		case 2:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ScenarioHash = value
			data = data[n:]
		case 3:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ChallengeStartUTC = int64(value)
			data = data[n:]
		case 4:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.SchemaVersion = uint32(value)
			data = data[n:]
		case 5:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			profile, err := parseChallengeProfileSnapshot(msg)
			if err != nil {
				return header, err
			}
			header.ChallengeProfile = profile
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return header, nil
}

func parseChallengeProfileSnapshot(data []byte) (models.ChallengeProfileSnapshot, error) {
	var profile models.ChallengeProfileSnapshot
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return profile, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.TimeLimit = math.Float32frombits(value)
			data = data[n:]
		case 2:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerProfile = value
			data = data[n:]
		case 3:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.AddedBots = append(profile.AddedBots, value)
			data = data[n:]
		case 4:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerMaxLives = int32(value)
			data = data[n:]
		case 5:
			values, n, err := consumePackedOrScalarInt32s(data, wireType)
			if err != nil {
				return profile, err
			}
			profile.BotMaxLives = append(profile.BotMaxLives, values...)
			data = data[n:]
		case 6:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerTeam = int32(value)
			data = data[n:]
		case 7:
			values, n, err := consumePackedOrScalarInt32s(data, wireType)
			if err != nil {
				return profile, err
			}
			profile.BotTeams = append(profile.BotTeams, values...)
			data = data[n:]
		case 8:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.MapName = value
			data = data[n:]
		case 9:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.MapScale = math.Float32frombits(value)
			data = data[n:]
		case 10:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.Timescale = math.Float32frombits(value)
			data = data[n:]
		case 11:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.EndChallengeAfterKills = math.Float32frombits(value)
			data = data[n:]
		case 12:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.EndChallengeAfterDamage = math.Float32frombits(value)
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return profile, nil
}

func parsePerformanceEvent(data []byte) (models.RunPerformanceEvent, error) {
	var event models.RunPerformanceEvent
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return event, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return event, protowire.ParseError(n)
			}
			event.Timestamp = math.Float32frombits(value)
			data = data[n:]
		case 2, 3, 4, 8, 9, 10, 12, 13:
			count, n, err := parseCountMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Count = &count
			data = data[n:]
		case 5, 6, 7, 11, 14, 15:
			delta, n, err := parseFloatValueMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Delta = &delta
			data = data[n:]
		case 16, 17, 18:
			value, n, err := parseFloatValueMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Value = &value
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return event, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return event, nil
}

func parseCountMessage(data []byte) (int32, int, error) {
	msg, n := protowire.ConsumeBytes(data)
	if n < 0 {
		return 0, 0, protowire.ParseError(n)
	}
	value, err := parseEmbeddedInt32Field(msg, 1)
	if err != nil {
		return 0, 0, err
	}
	return value, n, nil
}

func parseFloatValueMessage(data []byte) (float32, int, error) {
	msg, n := protowire.ConsumeBytes(data)
	if n < 0 {
		return 0, 0, protowire.ParseError(n)
	}
	value, err := parseEmbeddedFloat32Field(msg, 1)
	if err != nil {
		return 0, 0, err
	}
	return value, n, nil
}

func parseEmbeddedInt32Field(data []byte, wantField protowire.Number) (int32, error) {
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return 0, protowire.ParseError(consumed)
		}
		data = data[consumed:]
		if fieldNum == wantField {
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return 0, protowire.ParseError(n)
			}
			return int32(value), nil
		}
		n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
		if n < 0 {
			return 0, protowire.ParseError(n)
		}
		data = data[n:]
	}
	return 0, nil
}

func parseEmbeddedFloat32Field(data []byte, wantField protowire.Number) (float32, error) {
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return 0, protowire.ParseError(consumed)
		}
		data = data[consumed:]
		if fieldNum == wantField {
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return 0, protowire.ParseError(n)
			}
			return math.Float32frombits(value), nil
		}
		n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
		if n < 0 {
			return 0, protowire.ParseError(n)
		}
		data = data[n:]
	}
	return 0, nil
}

func consumePackedOrScalarInt32s(data []byte, wireType protowire.Type) ([]int32, int, error) {
	if wireType == protowire.BytesType {
		payload, n := protowire.ConsumeBytes(data)
		if n < 0 {
			return nil, 0, protowire.ParseError(n)
		}
		values := make([]int32, 0)
		for len(payload) > 0 {
			value, consumed := protowire.ConsumeVarint(payload)
			if consumed < 0 {
				return nil, 0, protowire.ParseError(consumed)
			}
			values = append(values, int32(value))
			payload = payload[consumed:]
		}
		return values, n, nil
	}
	value, n := protowire.ConsumeVarint(data)
	if n < 0 {
		return nil, 0, protowire.ParseError(n)
	}
	return []int32{int32(value)}, n, nil
}

func performancePayloadType(fieldNum protowire.Number) string {
	switch fieldNum {
	case 2:
		return "shotsFired"
	case 3:
		return "shotsHit"
	case 4:
		return "shotsMissed"
	case 5:
		return "damageDone"
	case 6:
		return "damagePossible"
	case 7:
		return "score"
	case 8:
		return "kills"
	case 9:
		return "deaths"
	case 10:
		return "overshots"
	case 11:
		return "playerDamageTaken"
	case 12:
		return "reloads"
	case 13:
		return "pauseCount"
	case 14:
		return "distanceTraveled"
	case 15:
		return "mbsPoints"
	case 16:
		return "targetSize"
	case 17:
		return "targetSpeed"
	case 18:
		return "randomSensScale"
	default:
		return ""
	}
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

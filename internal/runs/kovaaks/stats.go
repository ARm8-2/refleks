package kovaaks

import (
	"bufio"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"refleks/internal/models"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

type summaryField struct {
	rawKey string
	assign func(*models.RunStatsSummary, any)
	value  func(models.RunStatsSummary) any
}

var summaryFields = []summaryField{
	{rawKey: "Score", assign: func(s *models.RunStatsSummary, v any) { s.Score = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Score }},
	{rawKey: "Kills", assign: func(s *models.RunStatsSummary, v any) { s.Kills = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Kills }},
	{rawKey: "Deaths", assign: func(s *models.RunStatsSummary, v any) { s.Deaths = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Deaths }},
	{rawKey: "Fight Time", assign: func(s *models.RunStatsSummary, v any) { s.FightTime = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.FightTime }},
	{rawKey: "Time Remaining", assign: func(s *models.RunStatsSummary, v any) { s.TimeRemaining = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.TimeRemaining }},
	{rawKey: "Avg TTK", assign: func(s *models.RunStatsSummary, v any) { s.AvgTTK = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.AvgTTK }},
	{rawKey: "Damage Done", assign: func(s *models.RunStatsSummary, v any) { s.DamageDone = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.DamageDone }},
	{rawKey: "Total Overshots", assign: func(s *models.RunStatsSummary, v any) { s.TotalOvershots = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.TotalOvershots }},
	{rawKey: "Damage Taken", assign: func(s *models.RunStatsSummary, v any) { s.DamageTaken = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.DamageTaken }},
	{rawKey: "Hit Count", assign: func(s *models.RunStatsSummary, v any) { s.HitCount = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.HitCount }},
	{rawKey: "Miss Count", assign: func(s *models.RunStatsSummary, v any) { s.MissCount = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.MissCount }},
	{rawKey: "Midairs", assign: func(s *models.RunStatsSummary, v any) { s.Midairs = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Midairs }},
	{rawKey: "Midaired", assign: func(s *models.RunStatsSummary, v any) { s.Midaired = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Midaired }},
	{rawKey: "Directs", assign: func(s *models.RunStatsSummary, v any) { s.Directs = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Directs }},
	{rawKey: "Directed", assign: func(s *models.RunStatsSummary, v any) { s.Directed = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Directed }},
	{rawKey: "Reloads", assign: func(s *models.RunStatsSummary, v any) { s.Reloads = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Reloads }},
	{rawKey: "Distance Traveled", assign: func(s *models.RunStatsSummary, v any) { s.DistanceTraveled = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.DistanceTraveled }},
	{rawKey: "MBS Points", assign: func(s *models.RunStatsSummary, v any) { s.MBSPoints = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.MBSPoints }},
	{rawKey: "Scenario", assign: func(s *models.RunStatsSummary, v any) { s.Scenario = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Scenario }},
	{rawKey: "Hash", assign: func(s *models.RunStatsSummary, v any) { s.Hash = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Hash }},
	{rawKey: "Game Version", assign: func(s *models.RunStatsSummary, v any) { s.GameVersion = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.GameVersion }},
	{rawKey: "Challenge Start", assign: func(s *models.RunStatsSummary, v any) { s.ChallengeStart = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.ChallengeStart }},
	{rawKey: "Pause Count", assign: func(s *models.RunStatsSummary, v any) { s.PauseCount = int32FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.PauseCount }},
	{rawKey: "Pause Duration", assign: func(s *models.RunStatsSummary, v any) { s.PauseDuration = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.PauseDuration }},
	{rawKey: "Avg Target Scale", assign: func(s *models.RunStatsSummary, v any) { s.AvgTargetScale = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.AvgTargetScale }},
	{rawKey: "Avg Time Dilation", assign: func(s *models.RunStatsSummary, v any) { s.AvgTimeDilation = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.AvgTimeDilation }},
	{rawKey: "Input Lag", assign: func(s *models.RunStatsSummary, v any) { s.InputLag = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.InputLag }},
	{rawKey: "Max FPS (config)", assign: func(s *models.RunStatsSummary, v any) { s.MaxFPSConfig = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.MaxFPSConfig }},
	{rawKey: "Sens Scale", assign: func(s *models.RunStatsSummary, v any) { s.SensScale = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.SensScale }},
	{rawKey: "Sens Increment", assign: func(s *models.RunStatsSummary, v any) { s.SensIncrement = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.SensIncrement }},
	{rawKey: "Horiz Sens", assign: func(s *models.RunStatsSummary, v any) { s.HorizSens = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.HorizSens }},
	{rawKey: "Vert Sens", assign: func(s *models.RunStatsSummary, v any) { s.VertSens = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.VertSens }},
	{rawKey: "DPI", assign: func(s *models.RunStatsSummary, v any) { s.DPI = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.DPI }},
	{rawKey: "FOV", assign: func(s *models.RunStatsSummary, v any) { s.FOV = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.FOV }},
	{rawKey: "FOVScale", assign: func(s *models.RunStatsSummary, v any) { s.FOVScale = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.FOVScale }},
	{rawKey: "Hide Gun", assign: func(s *models.RunStatsSummary, v any) { s.HideGun = boolFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.HideGun }},
	{rawKey: "Crosshair", assign: func(s *models.RunStatsSummary, v any) { s.Crosshair = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Crosshair }},
	{rawKey: "Crosshair Scale", assign: func(s *models.RunStatsSummary, v any) { s.CrosshairScale = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.CrosshairScale }},
	{rawKey: "Crosshair Color", assign: func(s *models.RunStatsSummary, v any) { s.CrosshairColor = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.CrosshairColor }},
	{rawKey: "Resolution", assign: func(s *models.RunStatsSummary, v any) { s.Resolution = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Resolution }},
	{rawKey: "Avg FPS", assign: func(s *models.RunStatsSummary, v any) { s.AvgFPS = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.AvgFPS }},
	{rawKey: "Resolution Scale", assign: func(s *models.RunStatsSummary, v any) { s.ResolutionScale = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.ResolutionScale }},
	{rawKey: "Date Played", assign: func(s *models.RunStatsSummary, v any) { s.DatePlayed = stringFromAny(v) }, value: func(s models.RunStatsSummary) any { return s.DatePlayed }},
	{rawKey: "Accuracy", assign: func(s *models.RunStatsSummary, v any) { s.Accuracy = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Accuracy }},
	{rawKey: "Real Avg TTK", assign: func(s *models.RunStatsSummary, v any) { s.RealAvgTTK = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.RealAvgTTK }},
	{rawKey: "cm/360", assign: func(s *models.RunStatsSummary, v any) { s.Cm360 = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Cm360 }},
	{rawKey: "Duration", assign: func(s *models.RunStatsSummary, v any) { s.Duration = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Duration }},
	{rawKey: "Scenario Time", assign: func(s *models.RunStatsSummary, v any) { s.ScenarioTime = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.ScenarioTime }},
	{rawKey: "Time", assign: func(s *models.RunStatsSummary, v any) { s.Time = float64FromAny(v) }, value: func(s models.RunStatsSummary) any { return s.Time }},
}

func ParseStatsFile(path string) (models.RunStatsData, error) {
	file, err := os.Open(path)
	if err != nil {
		return models.RunStatsData{}, err
	}
	defer file.Close()

	wrapped, err := wrapReaderWithUTF8(file)
	if err != nil {
		return models.RunStatsData{}, err
	}

	reader := bufio.NewReader(wrapped)
	var eventRows [][]string
	var summaryLines []string
	isSummarySection := false

	for {
		line, readErr := reader.ReadString('\n')
		if errors.Is(readErr, io.EOF) {
			if len(line) == 0 {
				break
			}
		} else if readErr != nil {
			return models.RunStatsData{}, readErr
		}

		trimmed := strings.TrimRight(line, "\r\n")
		if trimmed == "" {
			if errors.Is(readErr, io.EOF) {
				break
			}
			continue
		}

		if !isSummarySection && strings.Contains(trimmed, ":,") {
			isSummarySection = true
		}
		if isSummarySection {
			summaryLines = append(summaryLines, trimmed)
		} else {
			row, err := parseCSVLine(trimmed)
			if err != nil {
				return models.RunStatsData{}, err
			}
			if isKillEventRow(row) {
				eventRows = append(eventRows, row)
			}
		}

		if errors.Is(readErr, io.EOF) {
			break
		}
	}

	return models.RunStatsData{
		Summary: DecodeStatsSummary(ParseStatsSummaryValues(summaryLines)),
		Events:  DecodeStatsEventRows(eventRows),
	}, nil
}

func EncodeStatsSummary(summary models.RunStatsSummary) map[string]any {
	raw := make(map[string]any, len(summaryFields))
	for _, field := range summaryFields {
		raw[field.rawKey] = field.value(summary)
	}
	return raw
}

func DecodeStatsSummary(raw map[string]any) models.RunStatsSummary {
	var summary models.RunStatsSummary
	for _, field := range summaryFields {
		value, ok := raw[field.rawKey]
		if !ok {
			continue
		}
		field.assign(&summary, value)
	}
	return summary
}

func ParseStatsSummaryValues(lines []string) map[string]any {
	values := make(map[string]any, len(lines))
	for _, line := range lines {
		parts := strings.SplitN(line, ":,", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		rawValue := strings.TrimSpace(parts[1])
		if i, err := strconv.Atoi(rawValue); err == nil {
			values[key] = i
			continue
		}
		if f, err := strconv.ParseFloat(rawValue, 64); err == nil {
			values[key] = f
			continue
		}
		if b, err := strconv.ParseBool(strings.ToLower(rawValue)); err == nil {
			values[key] = b
			continue
		}
		values[key] = rawValue
	}
	return values
}

func EncodeStatsEventRows(events []models.RunStatsEvent) [][]string {
	if len(events) == 0 {
		return nil
	}
	rows := make([][]string, 0, len(events))
	for _, event := range events {
		rows = append(rows, []string{
			strconv.FormatInt(int64(event.KillIndex), 10),
			event.Timestamp,
			event.Bot,
			event.Weapon,
			fmt.Sprintf("%.6fs", event.TTKSeconds),
			strconv.FormatInt(int64(event.Shots), 10),
			strconv.FormatInt(int64(event.Hits), 10),
			fmt.Sprintf("%.6f", event.Accuracy),
			fmt.Sprintf("%.6f", event.DamageDone),
			fmt.Sprintf("%.6f", event.DamagePossible),
			fmt.Sprintf("%.6f", event.Efficiency),
			strconv.FormatBool(event.Cheated),
			strconv.FormatInt(int64(event.OverShots), 10),
		})
	}
	return rows
}

func DecodeStatsEventRows(rows [][]string) []models.RunStatsEvent {
	if len(rows) == 0 {
		return nil
	}
	events := make([]models.RunStatsEvent, 0, len(rows))
	for _, row := range rows {
		event, ok := parseStatsEventRow(row)
		if ok {
			events = append(events, event)
		}
	}
	return events
}

func parseCSVLine(line string) ([]string, error) {
	reader := csv.NewReader(strings.NewReader(line))
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	return reader.Read()
}

func isInt(raw string) bool {
	_, err := strconv.Atoi(strings.TrimSpace(raw))
	return err == nil
}

func isKillEventRow(record []string) bool {
	if len(record) < 2 || !isInt(record[0]) {
		return false
	}
	timestamp := strings.TrimSpace(record[1])
	if len(timestamp) < 8 {
		return false
	}
	if !(timestamp[2] == ':' && timestamp[5] == ':') {
		return false
	}
	for _, ch := range []byte{timestamp[0], timestamp[1], timestamp[3], timestamp[4], timestamp[6], timestamp[7]} {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func wrapReaderWithUTF8(reader io.Reader) (io.Reader, error) {
	buffered := bufio.NewReader(reader)

	bom, _ := buffered.Peek(3)
	if len(bom) >= 3 && bom[0] == 0xEF && bom[1] == 0xBB && bom[2] == 0xBF {
		_, _ = buffered.Discard(3)
		return buffered, nil
	}
	if len(bom) >= 2 {
		if bom[0] == 0xFF && bom[1] == 0xFE {
			_, _ = buffered.Discard(2)
			return transform.NewReader(buffered, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
		if bom[0] == 0xFE && bom[1] == 0xFF {
			_, _ = buffered.Discard(2)
			return transform.NewReader(buffered, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
	}

	peek, _ := buffered.Peek(512)
	if len(peek) > 0 {
		evenNulls := 0
		oddNulls := 0
		for i := 0; i < len(peek); i++ {
			if peek[i] == 0 {
				if i%2 == 0 {
					evenNulls++
				} else {
					oddNulls++
				}
			}
		}
		if evenNulls+oddNulls > len(peek)/8 {
			if oddNulls > evenNulls {
				return transform.NewReader(buffered, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
			}
			return transform.NewReader(buffered, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
	}

	return buffered, nil
}

func parseStatsEventRow(row []string) (models.RunStatsEvent, bool) {
	if len(row) < 13 {
		return models.RunStatsEvent{}, false
	}
	killIndex, err := strconv.ParseInt(strings.TrimSpace(row[0]), 10, 32)
	if err != nil {
		return models.RunStatsEvent{}, false
	}
	return models.RunStatsEvent{
		KillIndex:      int32(killIndex),
		Timestamp:      strings.TrimSpace(row[1]),
		Bot:            strings.TrimSpace(row[2]),
		Weapon:         strings.TrimSpace(row[3]),
		TTKSeconds:     parseSecondsString(row[4]),
		Shots:          int32FromAny(row[5]),
		Hits:           int32FromAny(row[6]),
		Accuracy:       float64FromAny(row[7]),
		DamageDone:     float64FromAny(row[8]),
		DamagePossible: float64FromAny(row[9]),
		Efficiency:     float64FromAny(row[10]),
		Cheated:        boolFromAny(row[11]),
		OverShots:      int32FromAny(row[12]),
	}, true
}

func parseSecondsString(raw string) float64 {
	trimmed := strings.TrimSpace(strings.TrimSuffix(raw, "s"))
	value, _ := strconv.ParseFloat(trimmed, 64)
	return value
}

func int32FromAny(v any) int32 {
	switch value := v.(type) {
	case int:
		return int32(value)
	case int8:
		return int32(value)
	case int16:
		return int32(value)
	case int32:
		return value
	case int64:
		return int32(value)
	case uint:
		return int32(value)
	case uint8:
		return int32(value)
	case uint16:
		return int32(value)
	case uint32:
		return int32(value)
	case uint64:
		return int32(value)
	case float32:
		return int32(value)
	case float64:
		return int32(value)
	case string:
		if parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 32); err == nil {
			return int32(parsed)
		}
	}
	return 0
}

func float64FromAny(v any) float64 {
	switch value := v.(type) {
	case int:
		return float64(value)
	case int8:
		return float64(value)
	case int16:
		return float64(value)
	case int32:
		return float64(value)
	case int64:
		return float64(value)
	case uint:
		return float64(value)
	case uint8:
		return float64(value)
	case uint16:
		return float64(value)
	case uint32:
		return float64(value)
	case uint64:
		return float64(value)
	case float32:
		return float64(value)
	case float64:
		return value
	case string:
		if parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err == nil {
			return parsed
		}
	}
	return 0
}

func stringFromAny(v any) string {
	if text, ok := v.(string); ok {
		return strings.TrimSpace(text)
	}
	return ""
}

func boolFromAny(v any) bool {
	switch value := v.(type) {
	case bool:
		return value
	case string:
		trimmed := strings.TrimSpace(strings.ToLower(value))
		if trimmed == "true" {
			return true
		}
		if trimmed == "false" {
			return false
		}
	}
	return false
}

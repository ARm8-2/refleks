package runs

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"

	"google.golang.org/protobuf/encoding/protowire"

	"refleks/internal/models"
)

// ---- section envelope ----

// writeSection writes a length-prefixed blob to w.
func writeSection(w io.Writer, data []byte) error {
	if err := binary.Write(w, binary.LittleEndian, uint32(len(data))); err != nil {
		return err
	}
	if len(data) == 0 {
		return nil
	}
	_, err := w.Write(data)
	return err
}

func skipSection(r io.Reader) error {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return err
	}
	if size == 0 {
		return nil
	}
	_, err := io.CopyN(io.Discard, r, int64(size))
	return err
}

// fieldSizeBytes returns the section size without reading the data.
// Useful for progress updates or lightweight header parsing.
func fieldSizeBytes(r io.Reader) (uint32, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return 0, err
	}
	return size, nil
}

// ---- protowire write helpers ----

func encodeVarint(b []byte, field protowire.Number, v int64) []byte {
	b = protowire.AppendTag(b, field, protowire.VarintType)
	return protowire.AppendVarint(b, uint64(v))
}

func encodeUint32Varint(b []byte, field protowire.Number, v uint32) []byte {
	b = protowire.AppendTag(b, field, protowire.VarintType)
	return protowire.AppendVarint(b, uint64(v))
}

func encodeFixed64(b []byte, field protowire.Number, v float64) []byte {
	b = protowire.AppendTag(b, field, protowire.Fixed64Type)
	return protowire.AppendFixed64(b, math.Float64bits(v))
}

func encodeFixed32(b []byte, field protowire.Number, v float32) []byte {
	b = protowire.AppendTag(b, field, protowire.Fixed32Type)
	return protowire.AppendFixed32(b, math.Float32bits(v))
}

func encodeStringBytes(b []byte, field protowire.Number, s string) []byte {
	if s == "" {
		return b
	}
	b = protowire.AppendTag(b, field, protowire.BytesType)
	return protowire.AppendString(b, s)
}

func encodeNestedBytes(b []byte, field protowire.Number, data []byte) []byte {
	if len(data) == 0 {
		return b
	}
	b = protowire.AppendTag(b, field, protowire.BytesType)
	return protowire.AppendBytes(b, data)
}

func encodeBool(b []byte, field protowire.Number, v bool) []byte {
	if v {
		b = protowire.AppendTag(b, field, protowire.VarintType)
		return protowire.AppendVarint(b, 1)
	}
	return b
}

// ---- Stats section (RunStatsData: Summary + Events together) ----

func writeStatsSection(w io.Writer, stats models.RunStatsData) error {
	buf := make([]byte, 0, 2048)
	buf = encodeNestedBytes(buf, 1, encodeStatsSummary(stats.Summary))
	for _, ev := range stats.Events {
		buf = encodeNestedBytes(buf, 2, encodeStatsEvent(ev))
	}
	return writeSection(w, buf)
}

func encodeStatsSummary(s models.RunStatsSummary) []byte {
	buf := make([]byte, 0, 512)
	buf = encodeFixed64(buf, 1, s.Score)
	buf = encodeVarint(buf, 2, int64(s.Kills))
	buf = encodeVarint(buf, 3, int64(s.Deaths))
	buf = encodeFixed64(buf, 4, s.FightTime)
	buf = encodeFixed64(buf, 5, s.TimeRemaining)
	buf = encodeFixed64(buf, 6, s.AvgTTK)
	buf = encodeFixed64(buf, 7, s.DamageDone)
	buf = encodeVarint(buf, 8, int64(s.TotalOvershots))
	buf = encodeFixed64(buf, 9, s.DamageTaken)
	buf = encodeVarint(buf, 10, int64(s.HitCount))
	buf = encodeVarint(buf, 11, int64(s.MissCount))
	buf = encodeVarint(buf, 12, int64(s.Midairs))
	buf = encodeVarint(buf, 13, int64(s.Midaired))
	buf = encodeVarint(buf, 14, int64(s.Directs))
	buf = encodeVarint(buf, 15, int64(s.Directed))
	buf = encodeVarint(buf, 16, int64(s.Reloads))
	buf = encodeFixed64(buf, 17, s.DistanceTraveled)
	buf = encodeFixed64(buf, 18, s.MBSPoints)
	buf = encodeStringBytes(buf, 19, s.Scenario)
	buf = encodeStringBytes(buf, 20, s.Hash)
	buf = encodeStringBytes(buf, 21, s.GameVersion)
	buf = encodeStringBytes(buf, 22, s.ChallengeStart)
	buf = encodeVarint(buf, 23, int64(s.PauseCount))
	buf = encodeFixed64(buf, 24, s.PauseDuration)
	buf = encodeFixed64(buf, 25, s.AvgTargetScale)
	buf = encodeFixed64(buf, 26, s.AvgTimeDilation)
	buf = encodeFixed64(buf, 27, s.InputLag)
	buf = encodeFixed64(buf, 28, s.MaxFPSConfig)
	buf = encodeStringBytes(buf, 29, s.SensScale)
	buf = encodeFixed64(buf, 30, s.SensIncrement)
	buf = encodeFixed64(buf, 31, s.HorizSens)
	buf = encodeFixed64(buf, 32, s.VertSens)
	buf = encodeFixed64(buf, 33, s.DPI)
	buf = encodeFixed64(buf, 34, s.FOV)
	buf = encodeStringBytes(buf, 35, s.FOVScale)
	buf = encodeBool(buf, 36, s.HideGun)
	buf = encodeStringBytes(buf, 37, s.Crosshair)
	buf = encodeFixed64(buf, 38, s.CrosshairScale)
	buf = encodeStringBytes(buf, 39, s.CrosshairColor)
	buf = encodeStringBytes(buf, 40, s.Resolution)
	buf = encodeFixed64(buf, 41, s.AvgFPS)
	buf = encodeFixed64(buf, 42, s.ResolutionScale)
	buf = encodeStringBytes(buf, 43, s.DatePlayed)
	buf = encodeFixed64(buf, 44, s.Accuracy)
	buf = encodeFixed64(buf, 45, s.RealAvgTTK)
	buf = encodeFixed64(buf, 46, s.Cm360)
	buf = encodeFixed64(buf, 47, s.Duration)
	buf = encodeFixed64(buf, 48, s.ScenarioTime)
	buf = encodeFixed64(buf, 49, s.Time)
	return buf
}

func encodeStatsEvent(e models.RunStatsEvent) []byte {
	buf := make([]byte, 0, 64)
	buf = encodeVarint(buf, 1, int64(e.KillIndex))
	buf = encodeStringBytes(buf, 2, e.Timestamp)
	buf = encodeStringBytes(buf, 3, e.Bot)
	buf = encodeStringBytes(buf, 4, e.Weapon)
	buf = encodeFixed64(buf, 5, e.TTKSeconds)
	buf = encodeVarint(buf, 6, int64(e.Shots))
	buf = encodeVarint(buf, 7, int64(e.Hits))
	buf = encodeFixed64(buf, 8, e.Accuracy)
	buf = encodeFixed64(buf, 9, e.DamageDone)
	buf = encodeFixed64(buf, 10, e.DamagePossible)
	buf = encodeFixed64(buf, 11, e.Efficiency)
	buf = encodeBool(buf, 12, e.Cheated)
	buf = encodeVarint(buf, 13, int64(e.OverShots))
	return buf
}

// ---- Performances section (RunPerformanceData: Header + Events together) ----

func writePerformancesSection(w io.Writer, p *models.RunPerformanceData) error {
	if p == nil {
		return writeSection(w, nil)
	}
	buf := make([]byte, 0, 2048)
	buf = encodeNestedBytes(buf, 1, encodePerformanceHeader(p.Header))
	for _, ev := range p.Events {
		buf = encodeNestedBytes(buf, 2, encodePerformanceEvent(ev))
	}
	return writeSection(w, buf)
}

func encodePerformanceHeader(h models.RunPerformanceHeader) []byte {
	buf := make([]byte, 0, 256)
	buf = encodeStringBytes(buf, 1, h.ScenarioName)
	buf = encodeStringBytes(buf, 2, h.ScenarioHash)
	buf = encodeVarint(buf, 3, h.ChallengeStartUTC)
	buf = encodeUint32Varint(buf, 4, h.SchemaVersion)
	buf = encodeNestedBytes(buf, 5, encodeChallengeProfile(h.ChallengeProfile))
	return buf
}

func encodeChallengeProfile(cp models.ChallengeProfileSnapshot) []byte {
	buf := make([]byte, 0, 128)
	buf = encodeFixed32(buf, 1, cp.TimeLimit)
	buf = encodeStringBytes(buf, 2, cp.PlayerProfile)
	for _, bot := range cp.AddedBots {
		buf = encodeStringBytes(buf, 3, bot)
	}
	buf = encodeVarint(buf, 4, int64(cp.PlayerMaxLives))
	for _, v := range cp.BotMaxLives {
		buf = encodeVarint(buf, 5, int64(v))
	}
	buf = encodeVarint(buf, 6, int64(cp.PlayerTeam))
	for _, v := range cp.BotTeams {
		buf = encodeVarint(buf, 7, int64(v))
	}
	buf = encodeStringBytes(buf, 8, cp.MapName)
	buf = encodeFixed32(buf, 9, cp.MapScale)
	buf = encodeFixed32(buf, 10, cp.Timescale)
	buf = encodeFixed32(buf, 11, cp.EndChallengeAfterKills)
	buf = encodeFixed32(buf, 12, cp.EndChallengeAfterDamage)
	return buf
}

func encodePerformanceEvent(e models.RunPerformanceEvent) []byte {
	buf := make([]byte, 0, 32)
	buf = encodeFixed32(buf, 1, e.Timestamp)
	if e.PayloadType != "" {
		buf = encodeStringBytes(buf, 2, e.PayloadType)
	}
	if e.Count != nil {
		buf = encodeVarint(buf, 3, int64(*e.Count))
	}
	if e.Delta != nil {
		buf = encodeFixed32(buf, 4, float32(*e.Delta))
	}
	if e.Value != nil {
		buf = encodeFixed32(buf, 5, float32(*e.Value))
	}
	return buf
}

// ---- Mouse trace section ----

func writeMouseTraceSection(w io.Writer, points []models.MousePoint) error {
	if len(points) == 0 {
		return writeSection(w, nil)
	}
	data := make([]byte, 4+len(points)*mousePointByteSize)
	binary.LittleEndian.PutUint32(data[0:4], uint32(len(points)))
	for i, p := range points {
		off := 4 + i*mousePointByteSize
		binary.LittleEndian.PutUint64(data[off:off+8], uint64(p.TS))
		binary.LittleEndian.PutUint32(data[off+8:off+12], uint32(p.X))
		binary.LittleEndian.PutUint32(data[off+12:off+16], uint32(p.Y))
		binary.LittleEndian.PutUint32(data[off+16:off+20], uint32(p.Buttons))
	}
	return writeSection(w, data)
}

// ---- Environment section ----

func writeEnvironmentSection(w io.Writer, env models.RunEnvironment) error {
	buf := make([]byte, 0, 512)
	buf = encodeStringBytes(buf, 1, env.AppVersion)
	buf = encodeStringBytes(buf, 2, env.OS)
	buf = encodeStringBytes(buf, 3, env.Arch)
	buf = encodeStringBytes(buf, 4, env.OSVersion)
	buf = encodeStringBytes(buf, 5, env.SteamID)
	buf = encodeStringBytes(buf, 6, env.PersonaName)
	buf = encodeStringBytes(buf, 7, env.CPUName)
	buf = encodeVarint(buf, 8, int64(env.CPUCores))
	buf = encodeStringBytes(buf, 9, env.GPUName)
	buf = encodeVarint(buf, 10, int64(env.RAMTotalMB))
	buf = encodeFixed64(buf, 11, env.DisplayHz)
	buf = encodeVarint(buf, 12, int64(env.ScreenWidth))
	buf = encodeVarint(buf, 13, int64(env.ScreenHeight))
	buf = encodeBool(buf, 14, env.IsWindowed)
	buf = encodeStringBytes(buf, 15, env.MouseName)
	buf = encodeStringBytes(buf, 16, env.MouseVID)
	buf = encodeStringBytes(buf, 17, env.MousePID)
	buf = encodeStringBytes(buf, 18, env.MouseMI)
	buf = encodeStringBytes(buf, 19, env.MouseBackend)
	buf = encodeVarint(buf, 20, int64(env.TracePoints))
	buf = encodeFixed64(buf, 21, env.TraceDuration)
	buf = encodeVarint(buf, 22, int64(env.SampleRate))
	return writeSection(w, buf)
}

// ---- Decode helpers ----

func readStringTag(data []byte, field protowire.Number) (string, int, bool) {
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return "", 0, false
		}
		data = data[n:]
		if fn == field && wt == protowire.BytesType {
			s, n := protowire.ConsumeString(data)
			if n < 0 {
				return "", 0, false
			}
			return s, n, true
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			return "", 0, false
		}
		data = data[n:]
	}
	return "", 0, false
}

func readDoubleTag(data []byte, field protowire.Number) (float64, int, bool) {
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
		if fn == field && wt == protowire.Fixed64Type {
			v, n := protowire.ConsumeFixed64(data)
			if n < 0 {
				return 0, 0, false
			}
			return math.Float64frombits(v), n, true
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
	}
	return 0, 0, false
}

func readFloat32Tag(data []byte, field protowire.Number) (float32, int, bool) {
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
		if fn == field && wt == protowire.Fixed32Type {
			v, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return 0, 0, false
			}
			return math.Float32frombits(v), n, true
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
	}
	return 0, 0, false
}

func readVarintTag(data []byte, field protowire.Number) (int64, int, bool) {
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
		if fn == field && wt == protowire.VarintType {
			v, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return 0, 0, false
			}
			return int64(v), n, true
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			return 0, 0, false
		}
		data = data[n:]
	}
	return 0, 0, false
}

func readBytesTag(data []byte, field protowire.Number) ([]byte, int, bool) {
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return nil, 0, false
		}
		data = data[n:]
		if fn == field && wt == protowire.BytesType {
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, 0, false
			}
			return msg, n, true
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			return nil, 0, false
		}
		data = data[n:]
	}
	return nil, 0, false
}

func readBoolTag(data []byte, field protowire.Number) (bool, int, bool) {
	v, n, ok := readVarintTag(data, field)
	return v != 0, n, ok
}

// ---- Decode full messages ----

func readStatsSection(r io.Reader, includeEvents bool) (models.RunStatsData, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return models.RunStatsData{}, err
	}
	if size == 0 {
		return models.RunStatsData{}, nil
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(r, data); err != nil {
		return models.RunStatsData{}, fmt.Errorf("read stats section: %w", err)
	}
	return decodeStatsData(data, includeEvents)
}

func decodeStatsData(data []byte, includeEvents bool) (models.RunStatsData, error) {
	var stats models.RunStatsData
	var events []models.RunStatsEvent
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return stats, protowire.ParseError(n)
		}
		data = data[n:]
		switch fn {
		case 1:
			if wt != protowire.BytesType {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else {
				msg, n2 := protowire.ConsumeBytes(data)
				n = n2
				if n2 >= 0 {
					stats.Summary = decodeStatsSummary(msg)
				}
			}
		case 2:
			if !includeEvents {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else if wt != protowire.BytesType {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else {
				msg, n2 := protowire.ConsumeBytes(data)
				n = n2
				if n2 >= 0 {
					events = append(events, decodeStatsEvent(msg))
				}
			}
		default:
			n = protowire.ConsumeFieldValue(fn, wt, data)
		}
		if n < 0 {
			return stats, protowire.ParseError(n)
		}
		data = data[n:]
	}
	stats.Events = events
	return stats, nil
}

func decodeStatsSummary(data []byte) models.RunStatsSummary {
	var s models.RunStatsSummary
	if v, _, _ := readDoubleTag(data, 1); true {
		s.Score = v
	}
	if v, _, _ := readVarintTag(data, 2); true {
		s.Kills = int32(v)
	}
	if v, _, _ := readVarintTag(data, 3); true {
		s.Deaths = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 4); true {
		s.FightTime = v
	}
	if v, _, _ := readDoubleTag(data, 5); true {
		s.TimeRemaining = v
	}
	if v, _, _ := readDoubleTag(data, 6); true {
		s.AvgTTK = v
	}
	if v, _, _ := readDoubleTag(data, 7); true {
		s.DamageDone = v
	}
	if v, _, _ := readVarintTag(data, 8); true {
		s.TotalOvershots = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 9); true {
		s.DamageTaken = v
	}
	if v, _, _ := readVarintTag(data, 10); true {
		s.HitCount = int32(v)
	}
	if v, _, _ := readVarintTag(data, 11); true {
		s.MissCount = int32(v)
	}
	if v, _, _ := readVarintTag(data, 12); true {
		s.Midairs = int32(v)
	}
	if v, _, _ := readVarintTag(data, 13); true {
		s.Midaired = int32(v)
	}
	if v, _, _ := readVarintTag(data, 14); true {
		s.Directs = int32(v)
	}
	if v, _, _ := readVarintTag(data, 15); true {
		s.Directed = int32(v)
	}
	if v, _, _ := readVarintTag(data, 16); true {
		s.Reloads = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 17); true {
		s.DistanceTraveled = v
	}
	if v, _, _ := readDoubleTag(data, 18); true {
		s.MBSPoints = v
	}
	if v, _, _ := readStringTag(data, 19); true {
		s.Scenario = v
	}
	if v, _, _ := readStringTag(data, 20); true {
		s.Hash = v
	}
	if v, _, _ := readStringTag(data, 21); true {
		s.GameVersion = v
	}
	if v, _, _ := readStringTag(data, 22); true {
		s.ChallengeStart = v
	}
	if v, _, _ := readVarintTag(data, 23); true {
		s.PauseCount = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 24); true {
		s.PauseDuration = v
	}
	if v, _, _ := readDoubleTag(data, 25); true {
		s.AvgTargetScale = v
	}
	if v, _, _ := readDoubleTag(data, 26); true {
		s.AvgTimeDilation = v
	}
	if v, _, _ := readDoubleTag(data, 27); true {
		s.InputLag = v
	}
	if v, _, _ := readDoubleTag(data, 28); true {
		s.MaxFPSConfig = v
	}
	if v, _, _ := readStringTag(data, 29); true {
		s.SensScale = v
	}
	if v, _, _ := readDoubleTag(data, 30); true {
		s.SensIncrement = v
	}
	if v, _, _ := readDoubleTag(data, 31); true {
		s.HorizSens = v
	}
	if v, _, _ := readDoubleTag(data, 32); true {
		s.VertSens = v
	}
	if v, _, _ := readDoubleTag(data, 33); true {
		s.DPI = v
	}
	if v, _, _ := readDoubleTag(data, 34); true {
		s.FOV = v
	}
	if v, _, _ := readStringTag(data, 35); true {
		s.FOVScale = v
	}
	if v, _, _ := readBoolTag(data, 36); true {
		s.HideGun = v
	}
	if v, _, _ := readStringTag(data, 37); true {
		s.Crosshair = v
	}
	if v, _, _ := readDoubleTag(data, 38); true {
		s.CrosshairScale = v
	}
	if v, _, _ := readStringTag(data, 39); true {
		s.CrosshairColor = v
	}
	if v, _, _ := readStringTag(data, 40); true {
		s.Resolution = v
	}
	if v, _, _ := readDoubleTag(data, 41); true {
		s.AvgFPS = v
	}
	if v, _, _ := readDoubleTag(data, 42); true {
		s.ResolutionScale = v
	}
	if v, _, _ := readStringTag(data, 43); true {
		s.DatePlayed = v
	}
	if v, _, _ := readDoubleTag(data, 44); true {
		s.Accuracy = v
	}
	if v, _, _ := readDoubleTag(data, 45); true {
		s.RealAvgTTK = v
	}
	if v, _, _ := readDoubleTag(data, 46); true {
		s.Cm360 = v
	}
	if v, _, _ := readDoubleTag(data, 47); true {
		s.Duration = v
	}
	if v, _, _ := readDoubleTag(data, 48); true {
		s.ScenarioTime = v
	}
	if v, _, _ := readDoubleTag(data, 49); true {
		s.Time = v
	}
	return s
}

func decodeStatsEvent(data []byte) models.RunStatsEvent {
	var e models.RunStatsEvent
	if v, _, _ := readVarintTag(data, 1); true {
		e.KillIndex = int32(v)
	}
	if v, _, _ := readStringTag(data, 2); true {
		e.Timestamp = v
	}
	if v, _, _ := readStringTag(data, 3); true {
		e.Bot = v
	}
	if v, _, _ := readStringTag(data, 4); true {
		e.Weapon = v
	}
	if v, _, _ := readDoubleTag(data, 5); true {
		e.TTKSeconds = v
	}
	if v, _, _ := readVarintTag(data, 6); true {
		e.Shots = int32(v)
	}
	if v, _, _ := readVarintTag(data, 7); true {
		e.Hits = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 8); true {
		e.Accuracy = v
	}
	if v, _, _ := readDoubleTag(data, 9); true {
		e.DamageDone = v
	}
	if v, _, _ := readDoubleTag(data, 10); true {
		e.DamagePossible = v
	}
	if v, _, _ := readDoubleTag(data, 11); true {
		e.Efficiency = v
	}
	if v, _, _ := readBoolTag(data, 12); true {
		e.Cheated = v
	}
	if v, _, _ := readVarintTag(data, 13); true {
		e.OverShots = int32(v)
	}
	return e
}

func readPerformancesSection(r io.Reader, includeEvents bool) (*models.RunPerformanceData, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return nil, err
	}
	if size == 0 {
		return nil, nil
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, fmt.Errorf("read performances section: %w", err)
	}
	return decodePerformanceData(data, includeEvents)
}

func decodePerformanceData(data []byte, includeEvents bool) (*models.RunPerformanceData, error) {
	var result models.RunPerformanceData
	var events []models.RunPerformanceEvent
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			return nil, protowire.ParseError(n)
		}
		data = data[n:]
		switch fn {
		case 1:
			if wt != protowire.BytesType {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else {
				msg, n2 := protowire.ConsumeBytes(data)
				n = n2
				if n2 >= 0 {
					result.Header = decodePerformanceHeader(msg)
				}
			}
		case 2:
			if !includeEvents {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else if wt != protowire.BytesType {
				n = protowire.ConsumeFieldValue(fn, wt, data)
			} else {
				msg, n2 := protowire.ConsumeBytes(data)
				n = n2
				if n2 >= 0 {
					events = append(events, decodePerformanceEvent(msg))
				}
			}
		default:
			n = protowire.ConsumeFieldValue(fn, wt, data)
		}
		if n < 0 {
			return nil, protowire.ParseError(n)
		}
		data = data[n:]
	}
	result.Events = events
	return &result, nil
}

func decodePerformanceHeader(data []byte) models.RunPerformanceHeader {
	var h models.RunPerformanceHeader
	if v, _, _ := readStringTag(data, 1); true {
		h.ScenarioName = v
	}
	if v, _, _ := readStringTag(data, 2); true {
		h.ScenarioHash = v
	}
	if v, _, _ := readVarintTag(data, 3); true {
		h.ChallengeStartUTC = v
	}
	if v, _, _ := readVarintTag(data, 4); true {
		h.SchemaVersion = uint32(v)
	}
	if msg, _, _ := readBytesTag(data, 5); true {
		if len(msg) > 0 {
			h.ChallengeProfile = decodeChallengeProfile(msg)
		}
	}
	return h
}

func decodeChallengeProfile(data []byte) models.ChallengeProfileSnapshot {
	var cp models.ChallengeProfileSnapshot
	// Repeated fields accumulate across multiple tags.
	// We walk byte-by-byte with position tracking.
	type findResult struct {
		floatVal float32
		strVal   string
		intVal   int64
		pos      int
		found    bool
	}

	// Single-value fields: walk once for each
	for len(data) > 0 {
		fn, wt, n := protowire.ConsumeTag(data)
		if n < 0 {
			break
		}
		data = data[n:]
		switch fn {
		case 1:
			if wt == protowire.Fixed32Type {
				v, n := protowire.ConsumeFixed32(data)
				if n >= 0 {
					cp.TimeLimit = math.Float32frombits(v)
					data = data[n:]
					continue
				}
			}
		case 2:
			if wt == protowire.BytesType {
				v, n := protowire.ConsumeString(data)
				if n >= 0 {
					cp.PlayerProfile = v
					data = data[n:]
					continue
				}
			}
		case 3:
			if wt == protowire.BytesType {
				v, n := protowire.ConsumeString(data)
				if n >= 0 {
					cp.AddedBots = append(cp.AddedBots, v)
					data = data[n:]
					continue
				}
			}
		case 4:
			if wt == protowire.VarintType {
				v, n := protowire.ConsumeVarint(data)
				if n >= 0 {
					cp.PlayerMaxLives = int32(v)
					data = data[n:]
					continue
				}
			}
		case 5:
			if wt == protowire.VarintType {
				v, n := protowire.ConsumeVarint(data)
				if n >= 0 {
					cp.BotMaxLives = append(cp.BotMaxLives, int32(v))
					data = data[n:]
					continue
				}
			} else if wt == protowire.BytesType {
				// Packed varints
				packed, n := protowire.ConsumeBytes(data)
				if n >= 0 {
					for len(packed) > 0 {
						v, pn := protowire.ConsumeVarint(packed)
						if pn < 0 {
							break
						}
						cp.BotMaxLives = append(cp.BotMaxLives, int32(v))
						packed = packed[pn:]
					}
					data = data[n:]
					continue
				}
			}
		case 6:
			if wt == protowire.VarintType {
				v, n := protowire.ConsumeVarint(data)
				if n >= 0 {
					cp.PlayerTeam = int32(v)
					data = data[n:]
					continue
				}
			}
		case 7:
			if wt == protowire.VarintType {
				v, n := protowire.ConsumeVarint(data)
				if n >= 0 {
					cp.BotTeams = append(cp.BotTeams, int32(v))
					data = data[n:]
					continue
				}
			} else if wt == protowire.BytesType {
				packed, n := protowire.ConsumeBytes(data)
				if n >= 0 {
					for len(packed) > 0 {
						v, pn := protowire.ConsumeVarint(packed)
						if pn < 0 {
							break
						}
						cp.BotTeams = append(cp.BotTeams, int32(v))
						packed = packed[pn:]
					}
					data = data[n:]
					continue
				}
			}
		case 8:
			if wt == protowire.BytesType {
				v, n := protowire.ConsumeString(data)
				if n >= 0 {
					cp.MapName = v
					data = data[n:]
					continue
				}
			}
		case 9:
			if wt == protowire.Fixed32Type {
				v, n := protowire.ConsumeFixed32(data)
				if n >= 0 {
					cp.MapScale = math.Float32frombits(v)
					data = data[n:]
					continue
				}
			}
		case 10:
			if wt == protowire.Fixed32Type {
				v, n := protowire.ConsumeFixed32(data)
				if n >= 0 {
					cp.Timescale = math.Float32frombits(v)
					data = data[n:]
					continue
				}
			}
		case 11:
			if wt == protowire.Fixed32Type {
				v, n := protowire.ConsumeFixed32(data)
				if n >= 0 {
					cp.EndChallengeAfterKills = math.Float32frombits(v)
					data = data[n:]
					continue
				}
			}
		case 12:
			if wt == protowire.Fixed32Type {
				v, n := protowire.ConsumeFixed32(data)
				if n >= 0 {
					cp.EndChallengeAfterDamage = math.Float32frombits(v)
					data = data[n:]
					continue
				}
			}
		}
		n = protowire.ConsumeFieldValue(fn, wt, data)
		if n < 0 {
			break
		}
		data = data[n:]
	}
	return cp
}

func decodePerformanceEvent(data []byte) models.RunPerformanceEvent {
	var e models.RunPerformanceEvent
	if v, _, _ := readFloat32Tag(data, 1); true {
		e.Timestamp = v
	}
	if v, _, _ := readStringTag(data, 2); true {
		e.PayloadType = v
	}
	if v, _, ok := readVarintTag(data, 3); ok {
		c := int32(v)
		e.Count = &c
	}
	if v, _, ok := readFloat32Tag(data, 4); ok {
		d := v
		e.Delta = &d
	}
	if v, _, ok := readFloat32Tag(data, 5); ok {
		val := v
		e.Value = &val
	}
	return e
}

func readMouseTraceSection(r io.Reader, includePoints bool) ([]models.MousePoint, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return nil, err
	}
	if size == 0 || !includePoints {
		_, err := io.CopyN(io.Discard, r, int64(size))
		return nil, err
	}
	if size < 4 {
		return nil, fmt.Errorf("mouse trace section too small: %d", size)
	}
	limited := io.LimitReader(r, int64(size))
	var count uint32
	if err := binary.Read(limited, binary.LittleEndian, &count); err != nil {
		return nil, err
	}
	points := make([]models.MousePoint, count)
	for i := range points {
		if err := binary.Read(limited, binary.LittleEndian, &points[i].TS); err != nil {
			return nil, err
		}
		if err := binary.Read(limited, binary.LittleEndian, &points[i].X); err != nil {
			return nil, err
		}
		if err := binary.Read(limited, binary.LittleEndian, &points[i].Y); err != nil {
			return nil, err
		}
		if err := binary.Read(limited, binary.LittleEndian, &points[i].Buttons); err != nil {
			return nil, err
		}
	}
	return points, nil
}

func readEnvironmentSection(r io.Reader) (models.RunEnvironment, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return models.RunEnvironment{}, err
	}
	if size == 0 {
		return models.RunEnvironment{}, nil
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(r, data); err != nil {
		return models.RunEnvironment{}, fmt.Errorf("read environment section: %w", err)
	}
	return decodeEnvironment(data), nil
}

func decodeEnvironment(data []byte) models.RunEnvironment {
	var env models.RunEnvironment
	if v, _, _ := readStringTag(data, 1); true {
		env.AppVersion = v
	}
	if v, _, _ := readStringTag(data, 2); true {
		env.OS = v
	}
	if v, _, _ := readStringTag(data, 3); true {
		env.Arch = v
	}
	if v, _, _ := readStringTag(data, 4); true {
		env.OSVersion = v
	}
	if v, _, _ := readStringTag(data, 5); true {
		env.SteamID = v
	}
	if v, _, _ := readStringTag(data, 6); true {
		env.PersonaName = v
	}
	if v, _, _ := readStringTag(data, 7); true {
		env.CPUName = v
	}
	if v, _, _ := readVarintTag(data, 8); true {
		env.CPUCores = int32(v)
	}
	if v, _, _ := readStringTag(data, 9); true {
		env.GPUName = v
	}
	if v, _, _ := readVarintTag(data, 10); true {
		env.RAMTotalMB = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 11); true {
		env.DisplayHz = v
	}
	if v, _, _ := readVarintTag(data, 12); true {
		env.ScreenWidth = int32(v)
	}
	if v, _, _ := readVarintTag(data, 13); true {
		env.ScreenHeight = int32(v)
	}
	if v, _, _ := readBoolTag(data, 14); true {
		env.IsWindowed = v
	}
	if v, _, _ := readStringTag(data, 15); true {
		env.MouseName = v
	}
	if v, _, _ := readStringTag(data, 16); true {
		env.MouseVID = v
	}
	if v, _, _ := readStringTag(data, 17); true {
		env.MousePID = v
	}
	if v, _, _ := readStringTag(data, 18); true {
		env.MouseMI = v
	}
	if v, _, _ := readStringTag(data, 19); true {
		env.MouseBackend = v
	}
	if v, _, _ := readVarintTag(data, 20); true {
		env.TracePoints = int32(v)
	}
	if v, _, _ := readDoubleTag(data, 21); true {
		env.TraceDuration = v
	}
	if v, _, _ := readVarintTag(data, 22); true {
		env.SampleRate = int32(v)
	}
	return env
}

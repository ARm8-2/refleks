package runs

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/klauspost/compress/zstd"
	"github.com/zeebo/xxh3"

	"refleks/internal/models"
)

const (
	runMagic          = "RFLK"
	runVersionV1      = 1
	runVersionV2      = 2
	runVersionCurrent = runVersionV2

	runCompressionNone uint8 = 0
	runCompressionZstd uint8 = 1
	runHeaderSize            = int64(4 + 1 + 1 + 8)
	runChecksumSize          = int64(8)

	statTypeString = 1
	statTypeInt    = 2
	statTypeFloat  = 3
	statTypeBool   = 4
)

type readRecordOptions struct {
	skipStatsEvents       bool
	skipPerformanceEvents bool
	skipMouseTrace        bool
}

type storedRunRecord struct {
	FileVersion  uint8
	FileName     string
	EpochMilli   int64
	Stats        map[string]any
	Performances *models.RunPerformanceData
	MouseTrace   []models.MousePoint
	Env          models.RunEnvironment
}

func cloneStatsWithoutEvents(stats map[string]any) map[string]any {
	if len(stats) == 0 {
		return map[string]any{}
	}
	cloned := make(map[string]any, len(stats))
	for key, value := range stats {
		if key == "events" {
			continue
		}
		cloned[key] = value
	}
	return cloned
}

func withStatsEvents(stats map[string]any, statsEvents [][]string) map[string]any {
	normalized := cloneStatsWithoutEvents(stats)
	if statsEvents != nil {
		normalized["events"] = statsEvents
	}
	return normalized
}

func clonePerformanceWithoutEvents(performances *models.RunPerformanceData) *models.RunPerformanceData {
	if performances == nil {
		return nil
	}
	return &models.RunPerformanceData{Header: performances.Header}
}

func withPerformanceEvents(performances *models.RunPerformanceData, performanceEvents []models.RunPerformanceEvent) *models.RunPerformanceData {
	normalized := clonePerformanceWithoutEvents(performances)
	if normalized == nil {
		return nil
	}
	if performanceEvents != nil {
		normalized.Events = performanceEvents
	}
	return normalized
}

func runStatsEvents(stats map[string]any) [][]string {
	raw, ok := stats["events"]
	if !ok || raw == nil {
		return nil
	}
	if events, ok := raw.([][]string); ok {
		return events
	}
	rows, ok := raw.([]any)
	if !ok {
		return nil
	}
	events := make([][]string, 0, len(rows))
	for _, row := range rows {
		cols, ok := row.([]any)
		if !ok {
			continue
		}
		parsedRow := make([]string, 0, len(cols))
		for _, col := range cols {
			text, ok := col.(string)
			if !ok {
				continue
			}
			parsedRow = append(parsedRow, text)
		}
		events = append(events, parsedRow)
	}
	return events
}

func runPerformanceEvents(performances *models.RunPerformanceData) []models.RunPerformanceEvent {
	if performances == nil {
		return nil
	}
	return performances.Events
}

func writeRecord(w io.Writer, rec storedRunRecord) error {
	if _, err := w.Write([]byte(runMagic)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint8(runVersionCurrent)); err != nil {
		return err
	}

	compression := runCompressionZstd
	if err := binary.Write(w, binary.LittleEndian, compression); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, rec.EpochMilli); err != nil {
		return err
	}

	hasher := xxh3.New()
	hashedWriter := io.MultiWriter(w, hasher)
	payloadWriter, closePayload, err := newRunPayloadWriter(hashedWriter, compression)
	if err != nil {
		return err
	}

	payloadFileName := filepath.Base(rec.FileName)
	if err := writeString(payloadWriter, payloadFileName); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeStats(payloadWriter, cloneStatsWithoutEvents(rec.Stats)); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeStatsEvents(payloadWriter, runStatsEvents(rec.Stats)); err != nil {
		_ = closePayload()
		return err
	}
	if err := writePerformanceData(payloadWriter, rec.Performances); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeMouseTrace(payloadWriter, rec.MouseTrace); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeRunEnvironment(payloadWriter, rec.Env); err != nil {
		_ = closePayload()
		return err
	}

	if err := closePayload(); err != nil {
		return err
	}

	checksum := hasher.Sum64()
	return binary.Write(w, binary.LittleEndian, checksum)
}

func readRecordFile(path string, options readRecordOptions) (storedRunRecord, error) {
	f, err := os.Open(path)
	if err != nil {
		return storedRunRecord{}, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return storedRunRecord{}, err
	}
	if fi.Size() < runHeaderSize+runChecksumSize {
		return storedRunRecord{}, fmt.Errorf("invalid run file: too small")
	}

	var magic [4]byte
	if _, err := io.ReadFull(f, magic[:]); err != nil {
		return storedRunRecord{}, err
	}
	if string(magic[:]) != runMagic {
		return storedRunRecord{}, fmt.Errorf("invalid run file: bad magic")
	}

	var version uint8
	if err := binary.Read(f, binary.LittleEndian, &version); err != nil {
		return storedRunRecord{}, err
	}
	if version != runVersionV1 && version != runVersionV2 {
		return storedRunRecord{}, fmt.Errorf("unsupported run version: %d", version)
	}

	var compression uint8
	if err := binary.Read(f, binary.LittleEndian, &compression); err != nil {
		return storedRunRecord{}, err
	}

	var epochMilli int64
	if err := binary.Read(f, binary.LittleEndian, &epochMilli); err != nil {
		return storedRunRecord{}, err
	}

	encodedLen := fi.Size() - runHeaderSize - runChecksumSize
	if encodedLen < 0 {
		return storedRunRecord{}, fmt.Errorf("invalid run file: negative payload size")
	}

	hasher := xxh3.New()
	encodedReader := io.LimitReader(f, encodedLen)
	teedPayload := io.TeeReader(encodedReader, hasher)
	payloadReader, closePayload, err := newRunPayloadReader(teedPayload, compression)
	if err != nil {
		return storedRunRecord{}, err
	}

	var record storedRunRecord
	switch version {
	case runVersionV1:
		record, err = readRecordV1Payload(payloadReader, epochMilli, options)
	case runVersionV2:
		record, err = readRecordV2Payload(payloadReader, epochMilli, options)
	}
	if err != nil {
		_ = closePayload()
		return storedRunRecord{}, err
	}

	var trailing [1]byte
	if _, err := payloadReader.Read(trailing[:]); err != io.EOF {
		_ = closePayload()
		if err == nil {
			return storedRunRecord{}, fmt.Errorf("invalid run file: trailing payload data")
		}
		return storedRunRecord{}, err
	}
	if err := closePayload(); err != nil {
		return storedRunRecord{}, err
	}

	var wantChecksum uint64
	if err := binary.Read(f, binary.LittleEndian, &wantChecksum); err != nil {
		return storedRunRecord{}, err
	}
	if gotChecksum := hasher.Sum64(); gotChecksum != wantChecksum {
		return storedRunRecord{}, fmt.Errorf("invalid run file: checksum mismatch")
	}

	if extra, err := io.ReadAll(f); err != nil {
		return storedRunRecord{}, err
	} else if len(extra) > 0 {
		return storedRunRecord{}, fmt.Errorf("invalid run file: trailing bytes after checksum")
	}

	record.FileVersion = version

	return record, nil
}

func readRecordV1Payload(payloadReader io.Reader, epochMilli int64, options readRecordOptions) (storedRunRecord, error) {
	fileName, err := readString(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	stats, err := readStats(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}

	var statsEvents [][]string
	if options.skipStatsEvents {
		if err := skipStatsEvents(payloadReader); err != nil {
			return storedRunRecord{}, err
		}
	} else {
		statsEvents, err = readStatsEvents(payloadReader)
		if err != nil {
			return storedRunRecord{}, err
		}
		stats = withStatsEvents(stats, statsEvents)
	}

	trace := []models.MousePoint(nil)
	if options.skipMouseTrace {
		if err := skipMouseTrace(payloadReader); err != nil {
			return storedRunRecord{}, err
		}
	} else {
		trace, err = readMouseTrace(payloadReader)
		if err != nil {
			return storedRunRecord{}, err
		}
	}

	env, err := readRunEnvironment(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}

	return storedRunRecord{
		FileName:   fileName,
		EpochMilli: epochMilli,
		Stats:      stats,
		MouseTrace: trace,
		Env:        env,
	}, nil
}

func readRecordV2Payload(payloadReader io.Reader, epochMilli int64, options readRecordOptions) (storedRunRecord, error) {
	fileName, err := readString(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	stats, err := readStats(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}

	var statsEvents [][]string
	if options.skipStatsEvents {
		if err := skipStatsEvents(payloadReader); err != nil {
			return storedRunRecord{}, err
		}
	} else {
		statsEvents, err = readStatsEvents(payloadReader)
		if err != nil {
			return storedRunRecord{}, err
		}
		stats = withStatsEvents(stats, statsEvents)
	}

	var performances *models.RunPerformanceData
	performancePayload, err := readPerformancePayload(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	performances, err = readPerformanceData(performancePayload)
	if err != nil {
		return storedRunRecord{}, err
	}
	if !options.skipPerformanceEvents {
		performanceEvents, err := readPerformanceEvents(performancePayload)
		if err != nil {
			return storedRunRecord{}, err
		}
		performances = withPerformanceEvents(performances, performanceEvents)
	}

	trace := []models.MousePoint(nil)
	if options.skipMouseTrace {
		if err := skipMouseTrace(payloadReader); err != nil {
			return storedRunRecord{}, err
		}
	} else {
		trace, err = readMouseTrace(payloadReader)
		if err != nil {
			return storedRunRecord{}, err
		}
	}

	env, err := readRunEnvironment(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}

	return storedRunRecord{
		FileName:     fileName,
		EpochMilli:   epochMilli,
		Stats:        stats,
		Performances: performances,
		MouseTrace:   trace,
		Env:          env,
	}, nil
}

// Pooled zstd encoders/decoders to avoid per-file allocations.
var (
	zstdEncoderPool sync.Pool
	zstdDecoderPool sync.Pool
)

func newRunPayloadWriter(w io.Writer, compression uint8) (io.Writer, func() error, error) {
	switch compression {
	case runCompressionNone:
		return w, func() error { return nil }, nil
	case runCompressionZstd:
		var enc *zstd.Encoder
		if v := zstdEncoderPool.Get(); v != nil {
			enc = v.(*zstd.Encoder)
			enc.Reset(w)
		} else {
			var err error
			enc, err = zstd.NewWriter(w)
			if err != nil {
				return nil, nil, err
			}
		}
		return enc, func() error {
			err := enc.Close()
			zstdEncoderPool.Put(enc)
			return err
		}, nil
	default:
		return nil, nil, fmt.Errorf("unsupported run compression: %d", compression)
	}
}

func newRunPayloadReader(r io.Reader, compression uint8) (io.Reader, func() error, error) {
	switch compression {
	case runCompressionNone:
		return r, func() error { return nil }, nil
	case runCompressionZstd:
		var dec *zstd.Decoder
		if v := zstdDecoderPool.Get(); v != nil {
			dec = v.(*zstd.Decoder)
			if err := dec.Reset(r); err != nil {
				dec.Close()
				return nil, nil, err
			}
		} else {
			var err error
			dec, err = zstd.NewReader(r)
			if err != nil {
				return nil, nil, err
			}
		}
		return dec, func() error {
			zstdDecoderPool.Put(dec)
			return nil
		}, nil
	default:
		return nil, nil, fmt.Errorf("unsupported run compression: %d", compression)
	}
}

func writeString(w io.Writer, s string) error {
	b := []byte(s)
	if err := binary.Write(w, binary.LittleEndian, uint32(len(b))); err != nil {
		return err
	}
	if len(b) == 0 {
		return nil
	}
	_, err := w.Write(b)
	return err
}

func readString(r io.Reader) (string, error) {
	var n uint32
	if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
		return "", err
	}
	if n == 0 {
		return "", nil
	}
	b := make([]byte, n)
	if _, err := io.ReadFull(r, b); err != nil {
		return "", err
	}
	return string(b), nil
}

func writeStats(w io.Writer, stats map[string]any) error {
	if stats == nil {
		stats = map[string]any{}
	}
	keys := make([]string, 0, len(stats))
	for k := range stats {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	if err := binary.Write(w, binary.LittleEndian, uint32(len(keys))); err != nil {
		return err
	}

	for _, k := range keys {
		if err := writeString(w, k); err != nil {
			return err
		}
		typ, sval, ival, fval, bval := coerceStat(stats[k])
		if err := binary.Write(w, binary.LittleEndian, typ); err != nil {
			return err
		}
		switch typ {
		case statTypeString:
			if err := writeString(w, sval); err != nil {
				return err
			}
		case statTypeInt:
			if err := binary.Write(w, binary.LittleEndian, ival); err != nil {
				return err
			}
		case statTypeFloat:
			if err := binary.Write(w, binary.LittleEndian, fval); err != nil {
				return err
			}
		case statTypeBool:
			var v uint8
			if bval {
				v = 1
			}
			if err := binary.Write(w, binary.LittleEndian, v); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported stat type tag: %d", typ)
		}
	}

	return nil
}

func readStats(r io.Reader) (map[string]any, error) {
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return nil, err
	}

	stats := make(map[string]any, count)
	for i := uint32(0); i < count; i++ {
		key, err := readString(r)
		if err != nil {
			return nil, err
		}

		var typ uint8
		if err := binary.Read(r, binary.LittleEndian, &typ); err != nil {
			return nil, err
		}

		switch typ {
		case statTypeString:
			v, err := readString(r)
			if err != nil {
				return nil, err
			}
			stats[key] = v
		case statTypeInt:
			var v int64
			if err := binary.Read(r, binary.LittleEndian, &v); err != nil {
				return nil, err
			}
			stats[key] = v
		case statTypeFloat:
			var v float64
			if err := binary.Read(r, binary.LittleEndian, &v); err != nil {
				return nil, err
			}
			stats[key] = v
		case statTypeBool:
			var v uint8
			if err := binary.Read(r, binary.LittleEndian, &v); err != nil {
				return nil, err
			}
			stats[key] = (v == 1)
		default:
			return nil, fmt.Errorf("unsupported stat value type: %d", typ)
		}
	}

	return stats, nil
}

func coerceStat(v any) (typ uint8, sval string, ival int64, fval float64, bval bool) {
	switch t := v.(type) {
	case string:
		return statTypeString, t, 0, 0, false
	case bool:
		return statTypeBool, "", 0, 0, t
	case float32:
		return statTypeFloat, "", 0, float64(t), false
	case float64:
		return statTypeFloat, "", 0, t, false
	case int:
		return statTypeInt, "", int64(t), 0, false
	case int8:
		return statTypeInt, "", int64(t), 0, false
	case int16:
		return statTypeInt, "", int64(t), 0, false
	case int32:
		return statTypeInt, "", int64(t), 0, false
	case int64:
		return statTypeInt, "", t, 0, false
	case uint:
		if uint64(t) > math.MaxInt64 {
			return statTypeInt, "", math.MaxInt64, 0, false
		}
		return statTypeInt, "", int64(t), 0, false
	case uint8:
		return statTypeInt, "", int64(t), 0, false
	case uint16:
		return statTypeInt, "", int64(t), 0, false
	case uint32:
		return statTypeInt, "", int64(t), 0, false
	case uint64:
		if t > math.MaxInt64 {
			return statTypeInt, "", math.MaxInt64, 0, false
		}
		return statTypeInt, "", int64(t), 0, false
	default:
		return statTypeString, fmt.Sprintf("%v", t), 0, 0, false
	}
}

func writeStatsEvents(w io.Writer, statsEvents [][]string) error {
	if err := binary.Write(w, binary.LittleEndian, uint32(len(statsEvents))); err != nil {
		return err
	}
	for _, row := range statsEvents {
		if err := binary.Write(w, binary.LittleEndian, uint32(len(row))); err != nil {
			return err
		}
		for _, col := range row {
			if err := writeString(w, col); err != nil {
				return err
			}
		}
	}
	return nil
}

func readStatsEvents(r io.Reader) ([][]string, error) {
	var rows uint32
	if err := binary.Read(r, binary.LittleEndian, &rows); err != nil {
		return nil, err
	}

	statsEvents := make([][]string, rows)
	for i := uint32(0); i < rows; i++ {
		var cols uint32
		if err := binary.Read(r, binary.LittleEndian, &cols); err != nil {
			return nil, err
		}
		row := make([]string, cols)
		for j := uint32(0); j < cols; j++ {
			v, err := readString(r)
			if err != nil {
				return nil, err
			}
			row[j] = v
		}
		statsEvents[i] = row
	}
	return statsEvents, nil
}

func writePerformanceData(w io.Writer, performances *models.RunPerformanceData) error {
	if performances == nil {
		return binary.Write(w, binary.LittleEndian, uint32(0))
	}
	payload, err := json.Marshal(performances)
	if err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(payload))); err != nil {
		return err
	}
	if len(payload) == 0 {
		return nil
	}
	_, err = w.Write(payload)
	return err
}

func readPerformancePayload(r io.Reader) ([]byte, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return nil, err
	}
	if size == 0 {
		return nil, nil
	}
	payload := make([]byte, size)
	if _, err := io.ReadFull(r, payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func readPerformanceData(payload []byte) (*models.RunPerformanceData, error) {
	if payload == nil {
		return nil, nil
	}
	var summary struct {
		Header models.RunPerformanceHeader `json:"header"`
	}
	if err := json.Unmarshal(payload, &summary); err != nil {
		return nil, err
	}
	return &models.RunPerformanceData{Header: summary.Header}, nil
}

func readPerformanceEvents(payload []byte) ([]models.RunPerformanceEvent, error) {
	if payload == nil {
		return nil, nil
	}
	var performances models.RunPerformanceData
	if err := json.Unmarshal(payload, &performances); err != nil {
		return nil, err
	}
	return performances.Events, nil
}

func writeMouseTrace(w io.Writer, points []models.MousePoint) error {
	if err := binary.Write(w, binary.LittleEndian, uint32(len(points))); err != nil {
		return err
	}
	for _, p := range points {
		if err := binary.Write(w, binary.LittleEndian, p.TS); err != nil {
			return err
		}
		if err := binary.Write(w, binary.LittleEndian, p.X); err != nil {
			return err
		}
		if err := binary.Write(w, binary.LittleEndian, p.Y); err != nil {
			return err
		}
		if err := binary.Write(w, binary.LittleEndian, p.Buttons); err != nil {
			return err
		}
	}
	return nil
}

func readMouseTrace(r io.Reader) ([]models.MousePoint, error) {
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return nil, err
	}
	trace := make([]models.MousePoint, count)
	for i := uint32(0); i < count; i++ {
		var p models.MousePoint
		if err := binary.Read(r, binary.LittleEndian, &p.TS); err != nil {
			return nil, err
		}
		if err := binary.Read(r, binary.LittleEndian, &p.X); err != nil {
			return nil, err
		}
		if err := binary.Read(r, binary.LittleEndian, &p.Y); err != nil {
			return nil, err
		}
		if err := binary.Read(r, binary.LittleEndian, &p.Buttons); err != nil {
			return nil, err
		}
		trace[i] = p
	}
	return trace, nil
}

func writeRunEnvironment(w io.Writer, env models.RunEnvironment) error {
	if err := writeString(w, env.AppVersion); err != nil {
		return err
	}
	if err := writeString(w, env.OS); err != nil {
		return err
	}
	if err := writeString(w, env.Arch); err != nil {
		return err
	}
	if err := writeString(w, env.OSVersion); err != nil {
		return err
	}
	if err := writeString(w, env.SteamID); err != nil {
		return err
	}
	if err := writeString(w, env.PersonaName); err != nil {
		return err
	}

	if err := writeString(w, env.CPUName); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.CPUCores); err != nil {
		return err
	}
	if err := writeString(w, env.GPUName); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.RAMTotalMB); err != nil {
		return err
	}

	if err := binary.Write(w, binary.LittleEndian, env.DisplayHz); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.ScreenWidth); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.ScreenHeight); err != nil {
		return err
	}
	var isWindowed uint8
	if env.IsWindowed {
		isWindowed = 1
	}
	if err := binary.Write(w, binary.LittleEndian, isWindowed); err != nil {
		return err
	}

	if err := writeString(w, env.MouseName); err != nil {
		return err
	}
	if err := writeString(w, env.MouseVID); err != nil {
		return err
	}
	if err := writeString(w, env.MousePID); err != nil {
		return err
	}
	if err := writeString(w, env.MouseMI); err != nil {
		return err
	}
	if err := writeString(w, env.MouseBackend); err != nil {
		return err
	}

	if err := binary.Write(w, binary.LittleEndian, env.TracePoints); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.TraceDuration); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, env.SampleRate); err != nil {
		return err
	}
	return nil
}

func readRunEnvironment(r io.Reader) (models.RunEnvironment, error) {
	appVersion, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	osName, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	arch, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	osVersion, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	steamID, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	personaName, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}

	cpuName, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	var cpuCores int32
	if err := binary.Read(r, binary.LittleEndian, &cpuCores); err != nil {
		return models.RunEnvironment{}, err
	}
	gpuName, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	var ramTotalMB int32
	if err := binary.Read(r, binary.LittleEndian, &ramTotalMB); err != nil {
		return models.RunEnvironment{}, err
	}

	var displayHz float64
	if err := binary.Read(r, binary.LittleEndian, &displayHz); err != nil {
		return models.RunEnvironment{}, err
	}
	var screenWidth int32
	if err := binary.Read(r, binary.LittleEndian, &screenWidth); err != nil {
		return models.RunEnvironment{}, err
	}
	var screenHeight int32
	if err := binary.Read(r, binary.LittleEndian, &screenHeight); err != nil {
		return models.RunEnvironment{}, err
	}
	var isWindowed uint8
	if err := binary.Read(r, binary.LittleEndian, &isWindowed); err != nil {
		return models.RunEnvironment{}, err
	}

	mouseName, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	mouseVID, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	mousePID, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	mouseMI, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}
	mouseBackend, err := readString(r)
	if err != nil {
		return models.RunEnvironment{}, err
	}

	var tracePoints int32
	if err := binary.Read(r, binary.LittleEndian, &tracePoints); err != nil {
		return models.RunEnvironment{}, err
	}
	var traceDuration float64
	if err := binary.Read(r, binary.LittleEndian, &traceDuration); err != nil {
		return models.RunEnvironment{}, err
	}
	var sampleRate int32
	if err := binary.Read(r, binary.LittleEndian, &sampleRate); err != nil {
		return models.RunEnvironment{}, err
	}

	return models.RunEnvironment{
		AppVersion:    appVersion,
		OS:            osName,
		Arch:          arch,
		OSVersion:     osVersion,
		SteamID:       steamID,
		PersonaName:   personaName,
		CPUName:       cpuName,
		CPUCores:      cpuCores,
		GPUName:       gpuName,
		RAMTotalMB:    ramTotalMB,
		DisplayHz:     displayHz,
		ScreenWidth:   screenWidth,
		ScreenHeight:  screenHeight,
		IsWindowed:    isWindowed == 1,
		MouseName:     mouseName,
		MouseVID:      mouseVID,
		MousePID:      mousePID,
		MouseMI:       mouseMI,
		MouseBackend:  mouseBackend,
		TracePoints:   tracePoints,
		TraceDuration: traceDuration,
		SampleRate:    sampleRate,
	}, nil
}

// ---- Skip helpers for selective reads ----

const mousePointByteSize = 8 + 4 + 4 + 4 // TS(int64) + X(int32) + Y(int32) + Buttons(int32)

func skipString(r io.Reader) error {
	var n uint32
	if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
		return err
	}
	if n > 0 {
		if _, err := io.CopyN(io.Discard, r, int64(n)); err != nil {
			return err
		}
	}
	return nil
}

func skipStatsEvents(r io.Reader) error {
	var rows uint32
	if err := binary.Read(r, binary.LittleEndian, &rows); err != nil {
		return err
	}
	for i := uint32(0); i < rows; i++ {
		var cols uint32
		if err := binary.Read(r, binary.LittleEndian, &cols); err != nil {
			return err
		}
		for j := uint32(0); j < cols; j++ {
			if err := skipString(r); err != nil {
				return err
			}
		}
	}
	return nil
}

// skipMouseTrace skips the mouse trace section.
func skipMouseTrace(r io.Reader) error {
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return err
	}
	if count > 0 {
		if _, err := io.CopyN(io.Discard, r, int64(count)*mousePointByteSize); err != nil {
			return err
		}
	}
	return nil
}

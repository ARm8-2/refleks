package runs

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/klauspost/compress/zstd"
	"github.com/zeebo/xxh3"

	"refleks/internal/models"
	"refleks/internal/runs/kovaaks"
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

	// v1 stat type tags — used only by readStatsSummaryMap for v1 compatibility.
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
	Stats        models.RunStatsData
	Performances *models.RunPerformanceData
	MouseTrace   []models.MousePoint
	Env          models.RunEnvironment
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
	if err := writeStatsSection(payloadWriter, rec.Stats); err != nil {
		_ = closePayload()
		return err
	}
	if err := writePerformancesSection(payloadWriter, rec.Performances); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeMouseTraceSection(payloadWriter, rec.MouseTrace); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeEnvironmentSection(payloadWriter, rec.Env); err != nil {
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

// ---- v1 payload reader (unchanged from original format) ----

func readRecordV1Payload(payloadReader io.Reader, epochMilli int64, options readRecordOptions) (storedRunRecord, error) {
	fileName, err := readString(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	summary, err := readStatsSummarySection(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	stats := models.RunStatsData{Summary: summary}

	if options.skipStatsEvents {
		if err := skipStatsEventsSection(payloadReader); err != nil {
			return storedRunRecord{}, err
		}
	} else {
		statsEvents, err := readStatsEventsSection(payloadReader)
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

// ---- v2 payload reader (protowire-based) ----

func readRecordV2Payload(payloadReader io.Reader, epochMilli int64, options readRecordOptions) (storedRunRecord, error) {
	fileName, err := readString(payloadReader)
	if err != nil {
		return storedRunRecord{}, err
	}
	stats, err := readStatsSection(payloadReader, !options.skipStatsEvents)
	if err != nil {
		return storedRunRecord{}, err
	}
	performances, err := readPerformancesSection(payloadReader, !options.skipPerformanceEvents)
	if err != nil {
		return storedRunRecord{}, err
	}
	trace, err := readMouseTraceSection(payloadReader, !options.skipMouseTrace)
	if err != nil {
		return storedRunRecord{}, err
	}
	env, err := readEnvironmentSection(payloadReader)
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

// ---- v1-only helpers (keep for backward compatibility) ----

func withStatsEvents(stats models.RunStatsData, events []models.RunStatsEvent) models.RunStatsData {
	if events == nil {
		return models.RunStatsData{Summary: stats.Summary}
	}
	return models.RunStatsData{Summary: stats.Summary, Events: events}
}

func readStatsSummarySection(r io.Reader) (models.RunStatsSummary, error) {
	rawStats, err := readStatsSummaryMap(r)
	if err != nil {
		return models.RunStatsSummary{}, err
	}
	return kovaaks.DecodeStatsSummary(rawStats), nil
}

func readStatsEventsSection(r io.Reader) ([]models.RunStatsEvent, error) {
	rows, err := readStatsEventRows(r)
	if err != nil {
		return nil, err
	}
	return kovaaks.DecodeStatsEventRows(rows), nil
}

func skipStatsEventsSection(r io.Reader) error {
	return skipStatsEventRows(r)
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

// ---- Shared binary helpers ----

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

// ---- v1 stat map helpers (used only by v1 read path) ----

func readStatsSummaryMap(r io.Reader) (map[string]any, error) {
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

func readStatsEventRows(r io.Reader) ([][]string, error) {
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

// ---- Skip helpers for selective reads ----

const mousePointByteSize = 8 + 4 + 4 + 4

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

func skipStatsEventRows(r io.Reader) error {
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

var (
	zstdEncoderPool sync.Pool
	zstdDecoderPool sync.Pool
)

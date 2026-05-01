package runs

import (
	"encoding/binary"
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
	runMagic   = "RFLK"
	runVersion = 1

	runCompressionNone uint8 = 0
	runCompressionZstd uint8 = 1
	runHeaderSize            = int64(4 + 1 + 1 + 8)
	runChecksumSize          = int64(8)

	statTypeString = 1
	statTypeInt    = 2
	statTypeFloat  = 3
	statTypeBool   = 4
)

// RunRecord contains a parsed run persisted in a .refleks file.
type RunRecord struct {
	FilePath   string
	FileName   string
	EpochMilli int64
	Stats      map[string]any
	Events     [][]string
	MouseTrace []models.MousePoint
	Env        models.RunEnvironment
}

type readRecordOptions struct {
	skipEvents     bool
	skipMouseTrace bool
}

func writeRecord(w io.Writer, rec RunRecord) error {
	if _, err := w.Write([]byte(runMagic)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint8(runVersion)); err != nil {
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
	if err := writeStats(payloadWriter, rec.Stats); err != nil {
		_ = closePayload()
		return err
	}
	if err := writeEvents(payloadWriter, rec.Events); err != nil {
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

func readRecordFile(path string, options readRecordOptions) (RunRecord, error) {
	f, err := os.Open(path)
	if err != nil {
		return RunRecord{}, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return RunRecord{}, err
	}
	if fi.Size() < runHeaderSize+runChecksumSize {
		return RunRecord{}, fmt.Errorf("invalid run file: too small")
	}

	var magic [4]byte
	if _, err := io.ReadFull(f, magic[:]); err != nil {
		return RunRecord{}, err
	}
	if string(magic[:]) != runMagic {
		return RunRecord{}, fmt.Errorf("invalid run file: bad magic")
	}

	var version uint8
	if err := binary.Read(f, binary.LittleEndian, &version); err != nil {
		return RunRecord{}, err
	}
	if version != runVersion {
		return RunRecord{}, fmt.Errorf("unsupported run version: %d", version)
	}

	var compression uint8
	if err := binary.Read(f, binary.LittleEndian, &compression); err != nil {
		return RunRecord{}, err
	}

	var epochMilli int64
	if err := binary.Read(f, binary.LittleEndian, &epochMilli); err != nil {
		return RunRecord{}, err
	}

	encodedLen := fi.Size() - runHeaderSize - runChecksumSize
	if encodedLen < 0 {
		return RunRecord{}, fmt.Errorf("invalid run file: negative payload size")
	}

	hasher := xxh3.New()
	encodedReader := io.LimitReader(f, encodedLen)
	teedPayload := io.TeeReader(encodedReader, hasher)
	payloadReader, closePayload, err := newRunPayloadReader(teedPayload, compression)
	if err != nil {
		return RunRecord{}, err
	}

	fileName, err := readString(payloadReader)
	if err != nil {
		_ = closePayload()
		return RunRecord{}, err
	}

	stats, err := readStats(payloadReader)
	if err != nil {
		_ = closePayload()
		return RunRecord{}, err
	}

	var events [][]string
	if options.skipEvents {
		if err := skipEvents(payloadReader); err != nil {
			_ = closePayload()
			return RunRecord{}, err
		}
	} else {
		events, err = readEvents(payloadReader)
		if err != nil {
			_ = closePayload()
			return RunRecord{}, err
		}
	}

	trace := []models.MousePoint(nil)
	if options.skipMouseTrace {
		if err := skipMouseTrace(payloadReader); err != nil {
			_ = closePayload()
			return RunRecord{}, err
		}
	} else {
		trace, err = readMouseTrace(payloadReader)
		if err != nil {
			_ = closePayload()
			return RunRecord{}, err
		}
	}

	env, err := readRunEnvironment(payloadReader)
	if err != nil {
		_ = closePayload()
		return RunRecord{}, err
	}

	var trailing [1]byte
	if _, err := payloadReader.Read(trailing[:]); err != io.EOF {
		_ = closePayload()
		if err == nil {
			return RunRecord{}, fmt.Errorf("invalid run file: trailing payload data")
		}
		return RunRecord{}, err
	}
	if err := closePayload(); err != nil {
		return RunRecord{}, err
	}

	var wantChecksum uint64
	if err := binary.Read(f, binary.LittleEndian, &wantChecksum); err != nil {
		return RunRecord{}, err
	}
	if gotChecksum := hasher.Sum64(); gotChecksum != wantChecksum {
		return RunRecord{}, fmt.Errorf("invalid run file: checksum mismatch")
	}

	if extra, err := io.ReadAll(f); err != nil {
		return RunRecord{}, err
	} else if len(extra) > 0 {
		return RunRecord{}, fmt.Errorf("invalid run file: trailing bytes after checksum")
	}

	return RunRecord{
		FileName:   fileName,
		EpochMilli: epochMilli,
		Stats:      stats,
		Events:     events,
		MouseTrace: trace,
		Env:        env,
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

func writeEvents(w io.Writer, events [][]string) error {
	if err := binary.Write(w, binary.LittleEndian, uint32(len(events))); err != nil {
		return err
	}
	for _, row := range events {
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

func readEvents(r io.Reader) ([][]string, error) {
	var rows uint32
	if err := binary.Read(r, binary.LittleEndian, &rows); err != nil {
		return nil, err
	}

	events := make([][]string, rows)
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
		events[i] = row
	}
	return events, nil
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

func skipEvents(r io.Reader) error {
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

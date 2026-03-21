package runs

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os"
	"sort"

	"refleks/internal/models"
)

const (
	runMagic   = "RFLK"
	runVersion = 1

	statTypeString = 1
	statTypeInt    = 2
	statTypeFloat  = 3
	statTypeBool   = 4
)

// RunRecord contains a parsed run persisted in a .refleks file.
type RunRecord struct {
	FilePath   string
	FileName   string
	Stats      map[string]any
	Events     [][]string
	MouseTrace []models.MousePoint
	Env        models.RunEnvironment
}

func writeRecord(w io.Writer, rec RunRecord) error {
	if _, err := w.Write([]byte(runMagic)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint8(runVersion)); err != nil {
		return err
	}

	if err := writeString(w, rec.FileName); err != nil {
		return err
	}
	if err := writeStats(w, rec.Stats); err != nil {
		return err
	}
	if err := writeEvents(w, rec.Events); err != nil {
		return err
	}
	if err := writeMouseTrace(w, rec.MouseTrace); err != nil {
		return err
	}
	return writeRunEnvironment(w, rec.Env)
}

func readRecordFile(path string) (RunRecord, error) {
	f, err := os.Open(path)
	if err != nil {
		return RunRecord{}, err
	}
	defer f.Close()

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

	fileName, err := readString(f)
	if err != nil {
		return RunRecord{}, err
	}

	stats, err := readStats(f)
	if err != nil {
		return RunRecord{}, err
	}

	events, err := readEvents(f)
	if err != nil {
		return RunRecord{}, err
	}

	trace, err := readMouseTrace(f)
	if err != nil {
		return RunRecord{}, err
	}

	env, err := readRunEnvironment(f)
	if err != nil {
		return RunRecord{}, err
	}

	return RunRecord{
		FileName:   fileName,
		Stats:      stats,
		Events:     events,
		MouseTrace: trace,
		Env:        env,
	}, nil
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
	if err := writeString(w, env.Hostname); err != nil {
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
	hostname, err := readString(r)
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
		Hostname:      hostname,
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

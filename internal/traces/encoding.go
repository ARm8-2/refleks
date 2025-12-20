package traces

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"

	"refleks/internal/models"
)

const (
	MagicHeader = "RTRC" // Refleks Trace
	Version1    = 1
)

// BinaryHeader represents the file structure.
// [Magic:4][Version:1][Flags:1][MetaLen:4][MetaJSON...][Count:4][Points...]
// Flags: 0x01 = Gzipped Points

type TraceMetadata struct {
	FileName     string `json:"fileName"`
	ScenarioName string `json:"scenarioName,omitempty"`
	DatePlayed   string `json:"datePlayed,omitempty"`
}

// WriteBinary writes the scenario data in a compact binary format.
func WriteBinary(w io.Writer, data ScenarioData) error {
	// 1. Write Header
	if _, err := w.Write([]byte(MagicHeader)); err != nil {
		return err
	}
	if _, err := w.Write([]byte{Version1}); err != nil {
		return err
	}
	// Flags: 0 for now (no compression on points yet, maybe later)
	if _, err := w.Write([]byte{0}); err != nil {
		return err
	}

	// 2. Prepare Metadata
	meta := TraceMetadata{
		FileName:     data.FileName,
		ScenarioName: data.ScenarioName,
		DatePlayed:   data.DatePlayed,
	}
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	// 3. Write Metadata Length and Data
	if err := binary.Write(w, binary.LittleEndian, uint32(len(metaBytes))); err != nil {
		return err
	}
	if _, err := w.Write(metaBytes); err != nil {
		return err
	}

	// 4. Write Points Count and Points
	return writePoints(w, data.MouseTrace)
}

// writePoints writes the count and then the points in binary format.
func writePoints(w io.Writer, points []models.MousePoint) error {
	count := uint32(len(points))
	if err := binary.Write(w, binary.LittleEndian, count); err != nil {
		return err
	}

	// Format: TS(int64 nano) | X(int32) | Y(int32) | Buttons(int32)
	// Total 20 bytes per point
	buf := make([]byte, 20)
	for _, p := range points {
		binary.LittleEndian.PutUint64(buf[0:], uint64(p.TS*1000000))
		binary.LittleEndian.PutUint32(buf[8:], uint32(p.X))
		binary.LittleEndian.PutUint32(buf[12:], uint32(p.Y))
		binary.LittleEndian.PutUint32(buf[16:], uint32(p.Buttons))
		if _, err := w.Write(buf); err != nil {
			return err
		}
	}
	return nil
}

// ReadBinary reads the scenario data from the binary format.
func ReadBinary(r io.Reader) (ScenarioData, error) {
	// 1. Check Header
	magic := make([]byte, 4)
	if _, err := io.ReadFull(r, magic); err != nil {
		return ScenarioData{}, err
	}
	if string(magic) != MagicHeader {
		return ScenarioData{}, fmt.Errorf("invalid magic header")
	}

	ver := make([]byte, 1)
	if _, err := io.ReadFull(r, ver); err != nil {
		return ScenarioData{}, err
	}
	if ver[0] != Version1 {
		return ScenarioData{}, fmt.Errorf("unsupported version: %d", ver[0])
	}

	flags := make([]byte, 1)
	if _, err := io.ReadFull(r, flags); err != nil {
		return ScenarioData{}, err
	}

	// 2. Read Metadata
	var metaLen uint32
	if err := binary.Read(r, binary.LittleEndian, &metaLen); err != nil {
		return ScenarioData{}, err
	}
	metaBytes := make([]byte, metaLen)
	if _, err := io.ReadFull(r, metaBytes); err != nil {
		return ScenarioData{}, err
	}
	var meta TraceMetadata
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return ScenarioData{}, err
	}

	// 3. Read Points
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return ScenarioData{}, err
	}

	points := make([]models.MousePoint, count)
	buf := make([]byte, 20)
	for i := uint32(0); i < count; i++ {
		if _, err := io.ReadFull(r, buf); err != nil {
			return ScenarioData{}, err
		}
		tsNano := int64(binary.LittleEndian.Uint64(buf[0:]))
		x := int32(binary.LittleEndian.Uint32(buf[8:]))
		y := int32(binary.LittleEndian.Uint32(buf[12:]))
		buttons := int32(binary.LittleEndian.Uint32(buf[16:]))

		points[i] = models.MousePoint{
			TS:      tsNano / 1000000,
			X:       x,
			Y:       y,
			Buttons: buttons,
		}
	}

	return ScenarioData{
		Version:      int(ver[0]),
		FileName:     meta.FileName,
		ScenarioName: meta.ScenarioName,
		DatePlayed:   meta.DatePlayed,
		MouseTrace:   points,
	}, nil
}

// CompressGzip wraps the writer in a gzip writer.
func CompressGzip(w io.Writer, data []byte) error {
	gw := gzip.NewWriter(w)
	defer gw.Close()
	_, err := gw.Write(data)
	return err
}

// DecompressGzip reads all data from a gzip reader.
func DecompressGzip(r io.Reader) ([]byte, error) {
	gr, err := gzip.NewReader(r)
	if err != nil {
		return nil, err
	}
	defer gr.Close()
	return io.ReadAll(gr)
}

// EncodeTraceBase64 encodes points to a compact binary buffer (no metadata) for frontend transfer,
// then returns it as a Base64 string.
// Format: [Count:4][Points...]
func EncodeTraceBase64(points []models.MousePoint) (string, error) {
	buf := new(bytes.Buffer)
	if err := writePoints(buf, points); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

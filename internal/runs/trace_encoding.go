package runs

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"

	"refleks/internal/models"
)

// EncodeTraceBase64 encodes points to the compact frontend wire format:
// [count:uint32][point x count], point=[ts:int64-nanoseconds|x:int32|y:int32|buttons:int32].
func EncodeTraceBase64(points []models.MousePoint) (string, error) {
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, uint32(len(points))); err != nil {
		return "", err
	}

	for _, p := range points {
		tsNanos := p.TS * 1_000_000
		if err := binary.Write(buf, binary.LittleEndian, tsNanos); err != nil {
			return "", err
		}
		if err := binary.Write(buf, binary.LittleEndian, p.X); err != nil {
			return "", err
		}
		if err := binary.Write(buf, binary.LittleEndian, p.Y); err != nil {
			return "", err
		}
		if err := binary.Write(buf, binary.LittleEndian, p.Buttons); err != nil {
			return "", err
		}
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

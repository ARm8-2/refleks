package runs

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"testing"

	"refleks/internal/models"
)

func TestEncodeTraceBase64(t *testing.T) {
	points := []models.MousePoint{
		{TS: 1000, X: 10, Y: -20, Buttons: 1},
		{TS: 2000, X: 0, Y: 0, Buttons: 0},
	}

	encoded, err := EncodeTraceBase64(points)
	if err != nil {
		t.Fatalf("EncodeTraceBase64: %v", err)
	}

	got, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("DecodeString: %v", err)
	}

	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, uint32(len(points)))
	for _, p := range points {
		_ = binary.Write(buf, binary.LittleEndian, p.TS*1_000_000)
		_ = binary.Write(buf, binary.LittleEndian, p.X)
		_ = binary.Write(buf, binary.LittleEndian, p.Y)
		_ = binary.Write(buf, binary.LittleEndian, p.Buttons)
	}

	if !bytes.Equal(got, buf.Bytes()) {
		t.Fatalf("encoded bytes = %x, want %x", got, buf.Bytes())
	}

	// One uint32 count + two 20-byte points.
	if want := 4 + 2*mousePointByteSize; len(got) != want {
		t.Fatalf("decoded length = %d, want %d", len(got), want)
	}
}

func TestEncodeTraceBase64Empty(t *testing.T) {
	encoded, err := EncodeTraceBase64(nil)
	if err != nil {
		t.Fatalf("EncodeTraceBase64: %v", err)
	}

	got, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("DecodeString: %v", err)
	}
	if len(got) != 4 || binary.LittleEndian.Uint32(got) != 0 {
		t.Fatalf("empty trace = %x, want a zero count", got)
	}
}

package parser

import (
	"bufio"
	"io"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

// WrapReaderWithUTF8 returns an io.Reader that yields UTF-8 text. If the
// underlying data is encoded as UTF-16 (with or without BOM) the returned
// reader will transparently decode it to UTF-8. If the data is already
// UTF-8 the original reader (buffered) is returned.
func WrapReaderWithUTF8(r io.Reader) (io.Reader, error) {
	br := bufio.NewReader(r)

	// Peek a few bytes to detect BOMs
	b, _ := br.Peek(3)
	if len(b) >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF {
		// UTF-8 BOM - discard
		_, _ = br.Discard(3)
		return br, nil
	}
	if len(b) >= 2 {
		if b[0] == 0xFF && b[1] == 0xFE {
			// UTF-16 LE BOM
			_, _ = br.Discard(2)
			return transform.NewReader(br, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
		if b[0] == 0xFE && b[1] == 0xFF {
			// UTF-16 BE BOM
			_, _ = br.Discard(2)
			return transform.NewReader(br, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
		}
	}

	// Heuristic: if many NUL bytes present in the first chunk, assume UTF-16
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

	// Default: assume UTF-8
	return br, nil
}

package constants

import (
	"errors"
	"testing"
)

func TestCodedErrorFormattingAndUnwrap(t *testing.T) {
	cause := errors.New("details")
	wrapped := WrapCoded(UpdateCheckFailed, cause)
	if got, want := wrapped.Error(), UpdateCheckFailed+": details"; got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}
	if !errors.Is(wrapped, cause) {
		t.Fatal("coded error did not unwrap to its cause")
	}
	var coded *CodedError
	if !errors.As(wrapped, &coded) || coded.Code != UpdateCheckFailed {
		t.Fatalf("errors.As coded error = %+v", coded)
	}
}

func TestCodedErrorWithoutCauseAndWrappingRules(t *testing.T) {
	plain := NewCoded(ReplayMissing)
	if got := plain.Error(); got != ReplayMissing {
		t.Fatalf("NewCoded error = %q, want %q", got, ReplayMissing)
	}
	if WrapCoded(UpdateCheckFailed, nil) != nil {
		t.Fatal("WrapCoded(nil) should return nil")
	}
	if got := WrapCoded(UpdateDownloadFailed, plain); got != plain {
		t.Fatal("wrapping an already coded error should preserve its identity")
	}
}

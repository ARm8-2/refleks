package process

import (
	"errors"
	"testing"
)

func TestProcessTransition(t *testing.T) {
	probeErr := errors.New("snapshot failed")
	tests := []struct {
		name        string
		wasRunning  bool
		observed    bool
		probeErr    error
		wantRunning bool
		wantStarted bool
		wantStopped bool
	}{
		{
			name:        "starts when process appears",
			observed:    true,
			wantRunning: true,
			wantStarted: true,
		},
		{
			name:        "stops when process disappears",
			wasRunning:  true,
			wantStopped: true,
		},
		{
			name:        "does not emit duplicate start",
			wasRunning:  true,
			observed:    true,
			wantRunning: true,
		},
		{
			name: "does not emit duplicate stop",
		},
		{
			name:        "probe error preserves running state",
			wasRunning:  true,
			probeErr:    probeErr,
			wantRunning: true,
		},
		{
			name:     "probe error preserves stopped state",
			probeErr: probeErr,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			running, started, stopped := processTransition(tt.wasRunning, tt.observed, tt.probeErr)
			if running != tt.wantRunning || started != tt.wantStarted || stopped != tt.wantStopped {
				t.Fatalf("processTransition() = (%v, %v, %v), want (%v, %v, %v)",
					running, started, stopped, tt.wantRunning, tt.wantStarted, tt.wantStopped)
			}
		})
	}
}

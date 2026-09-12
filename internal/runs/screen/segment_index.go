package screen

// segmentIndexName is the ffmpeg `-segment_list` file that ffmpeg maintains
// alongside a capture session's segment files. Rows are appended only once a
// segment is fully closed, so the index doubles as the "is this segment safe to
// read" signal.
const segmentIndexName = "segments.csv"

// segmentCoverageEpsilon tolerates the sub-frame rounding ffmpeg applies to the
// segment list timestamps when deciding whether a range is covered.
const segmentCoverageEpsilon = 0.05

// segmentEntry is one finalized segment's media-time range.
type segmentEntry struct {
	path             string
	startSec, endSec float64
}

// selectSegmentRange picks the contiguous run of finalized segments covering
// [windowStart, windowEnd) in media time. It returns the selected entries, the
// media-time start of the first selected segment, and whether the range is
// fully covered. A range whose beginning has already aged out of the rolling
// buffer, or that contains a hole (from retention pruning or a failed
// segment), is deliberately rejected rather than clamped: a plausible-looking
// but temporally shifted replay is worse than a missing one.
func selectSegmentRange(entries []segmentEntry, windowStart, windowEnd float64) ([]segmentEntry, float64, bool) {
	if len(entries) == 0 || !(windowEnd > windowStart) {
		return nil, 0, false
	}

	var selected []segmentEntry
	var firstStart, previousEnd float64
	for _, e := range entries {
		if e.endSec <= windowStart {
			continue
		}
		if e.startSec >= windowEnd {
			break
		}
		if len(selected) == 0 {
			if e.startSec > windowStart+segmentCoverageEpsilon {
				return nil, 0, false
			}
			firstStart = e.startSec
		} else if e.startSec > previousEnd+segmentCoverageEpsilon {
			// The CSV must describe one continuous media timeline; a gap means
			// there is no footage for part of the requested window.
			return nil, 0, false
		}
		selected = append(selected, e)
		previousEnd = e.endSec
	}
	if len(selected) == 0 || previousEnd < windowEnd-segmentCoverageEpsilon {
		return nil, 0, false
	}
	return selected, firstStart, true
}

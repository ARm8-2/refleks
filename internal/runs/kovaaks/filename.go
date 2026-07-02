package kovaaks

import (
	"fmt"
	"path/filepath"
	"regexp"
	"time"

	"refleks/internal/constants"
)

const filenamePatternPrefix = `^(?P<name>.+?)\s-\s.*?-\s(?P<dt>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})`

var (
	statsFilenameRe = regexp.MustCompile(
		filenamePatternPrefix + `\sStats` + regexp.QuoteMeta(constants.StatsFileExt) + `$`,
	)
	performancesFilenameRe = regexp.MustCompile(
		filenamePatternPrefix + `\sPerformance` + regexp.QuoteMeta(constants.PerformanceFileExt) + `$`,
	)
	runFilenameRe = regexp.MustCompile(
		filenamePatternPrefix + `(?:\sStats)?` + regexp.QuoteMeta(constants.RunFileExt) + `$`,
	)
	dtLayout = "2006.01.02-15.04.05"
)

type FilenameInfo struct {
	ScenarioName string
	DatePlayed   time.Time
}

func ParseFilename(filename string) (FilenameInfo, error) {
	base := filepath.Base(filename)
	var match []string
	for _, re := range []*regexp.Regexp{statsFilenameRe, performancesFilenameRe, runFilenameRe} {
		match = re.FindStringSubmatch(base)
		if match != nil {
			break
		}
	}
	if match == nil {
		return FilenameInfo{}, fmt.Errorf("filename did not match expected format: %s", base)
	}
	datePlayed, err := time.ParseInLocation(dtLayout, match[2], time.Local)
	if err != nil {
		return FilenameInfo{}, err
	}
	return FilenameInfo{ScenarioName: match[1], DatePlayed: datePlayed}, nil
}

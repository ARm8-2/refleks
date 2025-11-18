package scenarios

import (
	"embed"
	"encoding/json"
)

//go:embed scenarios_data.json
var metaFS embed.FS

// ScenarioMeta captures curated metadata about a scenario to assist AI insights and recommendations.
type ScenarioMeta struct {
	Description   string             `json:"description,omitempty"`
	Tags          []string           `json:"tags,omitempty"`
	Difficulty    int                `json:"difficulty,omitempty"`
	LengthSeconds int                `json:"lengthSeconds,omitempty"`
	Percentiles   map[string]float64 `json:"percentiles,omitempty"`
	Bot           map[string]any     `json:"bot,omitempty"`
	Notes         string             `json:"notes,omitempty"`
}

var metaByName map[string]ScenarioMeta

// Get returns metadata for the exact or normalized scenario name if present.
func Get(name string) (ScenarioMeta, bool) {
	if m, ok := metaByName[name]; ok {
		return m, true
	}
	return ScenarioMeta{}, false
}

// All returns a copy of the metadata map.
func All() map[string]ScenarioMeta {
	out := make(map[string]ScenarioMeta, len(metaByName))
	for k, v := range metaByName {
		out[k] = v
	}
	return out
}

func init() {
	metaByName = map[string]ScenarioMeta{}
	b, err := metaFS.ReadFile("scenarios_data.json")
	if err != nil {
		return
	}
	_ = json.Unmarshal(b, &metaByName)
}

package benchmarks

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"refleks/internal/models"
)

type rawRank struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func parseProgressTokens(raw string) (scenarios []models.ScenarioProgress, ranks []rawRank, overallRank int, benchmarkProgress float64, err error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	scenarios = []models.ScenarioProgress{}

	var tok json.Token
	if tok, err = dec.Token(); err != nil {
		return
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		err = fmt.Errorf("progress: expected object start")
		return
	}

	for dec.More() {
		keyToken, tokenErr := dec.Token()
		if tokenErr != nil {
			err = tokenErr
			return
		}
		key, _ := keyToken.(string)

		switch key {
		case "categories":
			if parseErr := parseCategories(dec, &scenarios); parseErr != nil {
				err = parseErr
				return
			}
		case "ranks":
			var parsedRanks []rawRank
			if decodeErr := dec.Decode(&parsedRanks); decodeErr != nil {
				err = decodeErr
				return
			}
			for _, rank := range parsedRanks {
				if strings.EqualFold(strings.TrimSpace(rank.Name), "no rank") {
					continue
				}
				ranks = append(ranks, rank)
			}
		case "overall_rank":
			var num json.Number
			if decodeErr := dec.Decode(&num); decodeErr != nil {
				err = decodeErr
				return
			}
			if parsed, parseErr := num.Int64(); parseErr == nil {
				overallRank = int(parsed)
			}
		case "benchmark_progress":
			var num json.Number
			if decodeErr := dec.Decode(&num); decodeErr != nil {
				err = decodeErr
				return
			}
			if parsed, parseErr := num.Float64(); parseErr == nil {
				benchmarkProgress = parsed
			}
		default:
			var discard any
			if decodeErr := dec.Decode(&discard); decodeErr != nil {
				err = decodeErr
				return
			}
		}
	}

	if _, tokenErr := dec.Token(); tokenErr != nil {
		err = tokenErr
		return
	}
	return
}

func parseCategories(dec *json.Decoder, scenarios *[]models.ScenarioProgress) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("categories: expected '{'")
	}

	for dec.More() {
		if _, err := dec.Token(); err != nil {
			return err
		}
		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("categories: expected category object")
		}

		for dec.More() {
			fieldKeyToken, err := dec.Token()
			if err != nil {
				return err
			}
			fieldKey, _ := fieldKeyToken.(string)
			if fieldKey == "scenarios" {
				if err := parseScenarios(dec, scenarios); err != nil {
					return err
				}
				continue
			}
			var discard any
			if err := dec.Decode(&discard); err != nil {
				return err
			}
		}
		if _, err := dec.Token(); err != nil {
			return err
		}
	}

	_, err = dec.Token()
	return err
}

func parseScenarios(dec *json.Decoder, scenarios *[]models.ScenarioProgress) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("scenarios: expected '{'")
	}

	for dec.More() {
		nameToken, err := dec.Token()
		if err != nil {
			return err
		}
		name, _ := nameToken.(string)

		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("scenario: expected object")
		}

		scenario := models.ScenarioProgress{Name: name}
		for dec.More() {
			fieldKeyToken, err := dec.Token()
			if err != nil {
				return err
			}
			fieldKey, _ := fieldKeyToken.(string)

			switch fieldKey {
			case "score":
				var num json.Number
				if err := dec.Decode(&num); err != nil {
					return err
				}
				if parsed, parseErr := num.Float64(); parseErr == nil {
					scenario.Score = parsed / 100.0
				}
			case "scenario_rank":
				var num json.Number
				if err := dec.Decode(&num); err != nil {
					return err
				}
				if parsed, parseErr := num.Int64(); parseErr == nil {
					scenario.ScenarioRank = int(parsed)
				}
			case "rank_maxes":
				var arr []json.Number
				if err := dec.Decode(&arr); err != nil {
					return err
				}
				for _, num := range arr {
					if parsed, parseErr := num.Float64(); parseErr == nil {
						scenario.Thresholds = append(scenario.Thresholds, parsed)
					}
				}
			default:
				var discard any
				if err := dec.Decode(&discard); err != nil {
					return err
				}
			}
		}

		if _, err := dec.Token(); err != nil {
			return err
		}
		if len(scenario.Thresholds) > 0 {
			base := initialThresholdBaselineGo(scenario.Thresholds)
			scenario.Thresholds = append([]float64{base}, scenario.Thresholds...)
			maxThreshold := scenario.Thresholds[len(scenario.Thresholds)-1]
			if maxThreshold > 0 {
				scenario.Progress = (scenario.Score / maxThreshold) * 100.0
			}
		}
		*scenarios = append(*scenarios, scenario)
	}

	_, err = dec.Token()
	return err
}

func initialThresholdBaselineGo(thresholds []float64) float64 {
	if len(thresholds) <= 1 {
		return 0
	}

	diffs := make([]float64, 0, len(thresholds)-1)
	for i := 1; i < len(thresholds); i++ {
		delta := thresholds[i] - thresholds[i-1]
		if delta > 0 && !math.IsNaN(delta) && !math.IsInf(delta, 0) {
			diffs = append(diffs, delta)
		}
	}
	if len(diffs) == 0 {
		return 0
	}

	sum := 0.0
	for _, value := range diffs {
		sum += value
	}
	avg := sum / float64(len(diffs))
	previous := thresholds[0] - avg
	if previous > 0 {
		return previous
	}
	return 0
}

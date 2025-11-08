package benchmarks

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/steam"
	"strings"
	"sync"
	"time"
)

//go:embed benchmarks_data.json
var embeddedBenchmarks []byte

var (
	loadOnce sync.Once
	loadErr  error
	cache    []models.Benchmark
)

func GetBenchmarks() ([]models.Benchmark, error) {
	loadOnce.Do(func() {
		if len(embeddedBenchmarks) == 0 {
			loadErr = errors.New("embedded benchmarks data is empty")
			return
		}
		if err := json.Unmarshal(embeddedBenchmarks, &cache); err != nil {
			loadErr = fmt.Errorf("failed to parse embedded benchmarks: %w", err)
			return
		}
	})
	return cache, loadErr
}

// GetPlayerProgressRaw fetches the player progress JSON for a given benchmarkId.
// Order is preserved by the caller via a streaming decoder when needed.
func GetPlayerProgressRaw(benchmarkId int) (string, error) {
	steamID := steam.GetSteamID()
	if steamID == "" {
		return "", errors.New("steam ID not found")
	}
	url := fmt.Sprintf(constants.KovaaksPlayerProgressURL, benchmarkId, steamID)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch player progress: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d from progress endpoint", resp.StatusCode)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read progress response: %w", err)
	}
	return string(b), nil
}

func GetBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, error) {
	raw, err := GetPlayerProgressRaw(benchmarkId)
	if err != nil {
		return models.BenchmarkProgress{}, err
	}
	return buildStructuredProgress(raw, benchmarkId)
}

// internal structures used during parsing
type flatScenario struct {
	Name         string
	Score        float64
	ScenarioRank int
	Thresholds   []float64
}

type rawRank struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// buildStructuredProgress parses the upstream raw JSON preserving the scenario order,
// then maps it onto the benchmark definitions for the given benchmarkId.
func buildStructuredProgress(raw string, benchmarkId int) (models.BenchmarkProgress, error) {
	var out models.BenchmarkProgress

	// Step 1: parse top-level values using a streaming decoder
	flat, ranks, overallRank, benchProg, err := parseProgressTokens(raw)
	if err != nil {
		return out, err
	}

	// Step 2: locate matching difficulty metadata to derive grouping and colors
	_, diff := findDifficultyByBenchmarkID(benchmarkId)

	// Build rank defs combining upstream order with fallback colors from difficulty
	out.Ranks = mergeRankDefs(ranks, diff)
	out.OverallRank = overallRank
	out.BenchmarkProgress = benchProg

	// Step 3: group scenarios into categories/subcategories by scenarioCount
	out.Categories = groupScenariosByMeta(flat, diff)

	return out, nil
}

func findDifficultyByBenchmarkID(benchmarkId int) (*models.Benchmark, *models.BenchmarkDifficulty) {
	list, err := GetBenchmarks()
	if err != nil {
		return nil, nil
	}
	for i := range list {
		b := &list[i]
		for j := range b.Difficulties {
			d := &b.Difficulties[j]
			if d.KovaaksBenchmarkID == benchmarkId {
				return b, d
			}
		}
	}
	return nil, nil
}

func mergeRankDefs(ranks []rawRank, diff *models.BenchmarkDifficulty) []models.RankDef {
	defs := make([]models.RankDef, 0, len(ranks))
	var rankColors map[string]string
	if diff != nil && diff.RankColors != nil {
		rankColors = diff.RankColors
	}
	for _, r := range ranks {
		name := strings.TrimSpace(r.Name)
		if strings.EqualFold(name, "no rank") || name == "" {
			continue
		}
		col := strings.TrimSpace(r.Color)
		// Prefer configured colors from benchmark metadata (case-insensitive match)
		for k, v := range rankColors {
			if strings.EqualFold(strings.TrimSpace(k), name) && strings.TrimSpace(v) != "" {
				col = strings.TrimSpace(v)
				break
			}
		}
		if col == "" {
			col = "#60a5fa" // fallback if no color found anywhere
		}
		defs = append(defs, models.RankDef{Name: name, Color: col})
	}
	return defs
}

func groupScenariosByMeta(flat []flatScenario, diff *models.BenchmarkDifficulty) []models.ProgressCategory {
	cats := []models.ProgressCategory{}
	pos := 0
	if diff == nil || len(diff.Categories) == 0 {
		g := models.ProgressGroup{Scenarios: make([]models.ScenarioProgress, 0, len(flat))}
		for _, fs := range flat {
			g.Scenarios = append(g.Scenarios, models.ScenarioProgress{
				Name: fs.Name, Score: fs.Score, ScenarioRank: fs.ScenarioRank, Thresholds: fs.Thresholds,
			})
		}
		cats = append(cats, models.ProgressCategory{Name: "", Color: "", Groups: []models.ProgressGroup{g}})
		return cats
	}

	for ci, c := range diff.Categories {
		pc := models.ProgressCategory{Name: c.CategoryName, Color: c.Color}
		groups := make([]models.ProgressGroup, 0, len(c.Subcategories))
		for _, sub := range c.Subcategories {
			take := sub.ScenarioCount
			if take < 0 {
				take = 0
			}
			end := pos + take
			if end > len(flat) {
				end = len(flat)
			}
			g := models.ProgressGroup{Name: sub.SubcategoryName, Color: sub.Color}
			for i := pos; i < end; i++ {
				fs := flat[i]
				g.Scenarios = append(g.Scenarios, models.ScenarioProgress{
					Name: fs.Name, Score: fs.Score, ScenarioRank: fs.ScenarioRank, Thresholds: fs.Thresholds,
				})
			}
			pos = end
			groups = append(groups, g)
		}
		if ci == len(diff.Categories)-1 && pos < len(flat) {
			g := models.ProgressGroup{}
			for i := pos; i < len(flat); i++ {
				fs := flat[i]
				g.Scenarios = append(g.Scenarios, models.ScenarioProgress{
					Name: fs.Name, Score: fs.Score, ScenarioRank: fs.ScenarioRank, Thresholds: fs.Thresholds,
				})
			}
			pos = len(flat)
			groups = append(groups, g)
		}
		pc.Groups = groups
		cats = append(cats, pc)
	}
	return cats
}

// parseProgressTokens walks the raw JSON token stream to extract ordered scenarios,
// ranks, and summary numbers without decoding into Go maps (which would randomize order).
func parseProgressTokens(raw string) (flat []flatScenario, ranks []rawRank, overallRank int, benchProg float64, err error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	flat = []flatScenario{}
	var tok json.Token
	if tok, err = dec.Token(); err != nil {
		return
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		err = fmt.Errorf("progress: expected object start")
		return
	}
	for dec.More() {
		kt, e := dec.Token()
		if e != nil {
			err = e
			return
		}
		key, _ := kt.(string)
		switch key {
		case "categories":
			if e := parseCategories(dec, &flat); e != nil {
				err = e
				return
			}
		case "ranks":
			var rr []rawRank
			if e := dec.Decode(&rr); e != nil {
				err = e
				return
			}
			for _, r := range rr {
				if strings.EqualFold(strings.TrimSpace(r.Name), "no rank") {
					continue
				}
				ranks = append(ranks, r)
			}
		case "overall_rank":
			var n json.Number
			if e := dec.Decode(&n); e != nil {
				err = e
				return
			}
			if v, e2 := n.Int64(); e2 == nil {
				overallRank = int(v)
			}
		case "benchmark_progress":
			var n json.Number
			if e := dec.Decode(&n); e != nil {
				err = e
				return
			}
			if f, e2 := n.Float64(); e2 == nil {
				benchProg = f
			}
		default:
			var discard any
			if e := dec.Decode(&discard); e != nil {
				err = e
				return
			}
		}
	}
	if _, e := dec.Token(); e != nil {
		err = e
		return
	}
	return
}

func parseCategories(dec *json.Decoder, flat *[]flatScenario) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("categories: expected '{'")
	}
	for dec.More() {
		// category key
		if _, err := dec.Token(); err != nil {
			return err
		}
		// category object start
		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("categories: expected category object")
		}
		for dec.More() {
			fkeyTok, err := dec.Token()
			if err != nil {
				return err
			}
			fkey, _ := fkeyTok.(string)
			if fkey == "scenarios" {
				if err := parseScenarios(dec, flat); err != nil {
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

func parseScenarios(dec *json.Decoder, flat *[]flatScenario) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("scenarios: expected '{'")
	}
	for dec.More() {
		nt, err := dec.Token()
		if err != nil {
			return err
		}
		name, _ := nt.(string)
		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("scenario: expected object")
		}
		s := flatScenario{Name: name}
		for dec.More() {
			fkTok, err := dec.Token()
			if err != nil {
				return err
			}
			fk, _ := fkTok.(string)
			switch fk {
			case "score":
				var n json.Number
				if err := dec.Decode(&n); err != nil {
					return err
				}
				if f, e2 := n.Float64(); e2 == nil {
					s.Score = f / 100.0
				}
			case "scenario_rank":
				var n json.Number
				if err := dec.Decode(&n); err != nil {
					return err
				}
				if v, e2 := n.Int64(); e2 == nil {
					s.ScenarioRank = int(v)
				}
			case "rank_maxes":
				var arr []json.Number
				if err := dec.Decode(&arr); err != nil {
					return err
				}
				for _, n := range arr {
					if f, e2 := n.Float64(); e2 == nil {
						s.Thresholds = append(s.Thresholds, f)
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
		// Compute and prepend baseline threshold (as we previously did on the frontend)
		if len(s.Thresholds) > 0 {
			base := initialThresholdBaselineGo(s.Thresholds)
			s.Thresholds = append([]float64{base}, s.Thresholds...)
		}
		*flat = append(*flat, s)
	}
	_, err = dec.Token()
	return err
}

// initialThresholdBaselineGo replicates the frontend logic:
// take average diff between successive thresholds and subtract from first threshold, clamped to 0.
func initialThresholdBaselineGo(thresholds []float64) float64 {
	n := len(thresholds)
	if n <= 1 {
		return 0
	}
	diffs := make([]float64, 0, n-1)
	for i := 1; i < n; i++ {
		a := thresholds[i]
		b := thresholds[i-1]
		d := a - b
		if d > 0 && !math.IsNaN(d) && !math.IsInf(d, 0) {
			diffs = append(diffs, d)
		}
	}
	if len(diffs) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range diffs {
		sum += x
	}
	avg := sum / float64(len(diffs))
	prev := thresholds[0] - avg
	if prev > 0 {
		return prev
	}
	return 0
}

// Note: use math.IsNaN / math.IsInf from the standard library above.

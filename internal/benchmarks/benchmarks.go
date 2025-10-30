package benchmarks

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
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

// GetPlayerProgressRaw fetches the player progress JSON for a given benchmarkId
// and returns the raw JSON string without decoding it server-side. This preserves
// the original key order from the upstream API so the frontend can rely on it
// (e.g., for scenarios ordering).
func GetPlayerProgressRaw(benchmarkId int) (string, error) {
	steamID := GetSteamID()
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

func GetSteamID() string {
	// Priority 1: explicit override in settings (Advanced)
	if s, err := settings.Load(); err == nil {
		s = settings.Sanitize(s)
		if v := strings.TrimSpace(s.SteamIDOverride); v != "" {
			return v
		}
	} else {
		// If settings are not present, still allow runtime defaults to be considered for path building below
		_ = err
	}

	// Priority 2: environment variable override (useful for dev containers/CI)
	if env := settings.GetEnv(constants.EnvSteamIDVar); strings.TrimSpace(env) != "" {
		return strings.TrimSpace(env)
	}

	// Priority 3: parse Steam's loginusers.vdf to find MostRecent user
	loginUsersPath := steamLoginUsersPath()
	id, err := parseMostRecentSteamID(loginUsersPath)
	if err != nil {
		return ""
	}
	return id
}

// steamLoginUsersPath builds the expected path to Steam's loginusers.vdf using settings.
func steamLoginUsersPath() string {
	// Load settings if present; otherwise use defaults
	s, err := settings.Load()
	if err != nil {
		s = settings.Default()
	}
	s = settings.Sanitize(s)
	steamDir := settings.ExpandPathPlaceholders(s.SteamInstallDir)
	// Compose path to config/loginusers.vdf (use OS-specific separator)
	return filepath.Join(steamDir, "config", "loginusers.vdf")
}

// parseMostRecentSteamID parses the Valve KeyValues (VDF) loginusers file and returns
// the SteamID64 for the entry marked with MostRecent = 1.
func parseMostRecentSteamID(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	// Remove // comments to simplify tokenization
	cleaned := stripVDFComments(string(b))
	// Tokenize: quoted strings and braces
	type tok struct {
		kind string // "str", "brace"
		val  string // token value or brace char
	}

	tokens := make([]tok, 0, 1024)
	i := 0
	for i < len(cleaned) {
		// skip whitespace
		c := cleaned[i]
		if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
			i++
			continue
		}
		if c == '"' {
			// parse quoted string (supports escaped \" minimally)
			j := i + 1
			var sb []rune
			for j < len(cleaned) {
				ch := cleaned[j]
				if ch == '\\' && j+1 < len(cleaned) && cleaned[j+1] == '"' {
					sb = append(sb, '"')
					j += 2
					continue
				}
				if ch == '"' {
					break
				}
				sb = append(sb, rune(ch))
				j++
			}
			tokens = append(tokens, tok{kind: "str", val: string(sb)})
			// move past closing quote if present
			if j < len(cleaned) && cleaned[j] == '"' {
				j++
			}
			i = j
			continue
		}
		if c == '{' || c == '}' {
			tokens = append(tokens, tok{kind: "brace", val: string(c)})
			i++
			continue
		}
		// bare token (unquoted), read until whitespace or brace
		j := i
		for j < len(cleaned) {
			ch := cleaned[j]
			if ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' || ch == '{' || ch == '}' {
				break
			}
			j++
		}
		if j > i {
			tokens = append(tokens, tok{kind: "str", val: cleaned[i:j]})
		}
		i = j
	}

	// Parse expecting structure: "users" { "<id>" { ... } ... }
	idx := 0
	next := func() (tok, bool) {
		if idx >= len(tokens) {
			return tok{}, false
		}
		t := tokens[idx]
		idx++
		return t, true
	}
	// find top-level key "users"
	for {
		t, ok := next()
		if !ok {
			return "", fmt.Errorf("'users' section not found")
		}
		if t.kind == "str" && equalFoldTrim(t.val, "users") {
			break
		}
	}
	t, ok := next()
	if !ok || t.kind != "brace" || t.val != "{" {
		return "", fmt.Errorf("missing '{' after users")
	}

	// iterate over entries: "<steamid>" { kv }
	for {
		key, ok := next()
		if !ok {
			break
		}
		if key.kind == "brace" && key.val == "}" {
			// end of users block
			break
		}
		if key.kind != "str" {
			// skip unexpected token
			continue
		}
		steamID := key.val
		// next must be '{'
		t, ok = next()
		if !ok || t.kind != "brace" || t.val != "{" {
			// malformed; attempt to continue
			continue
		}
		// parse block until matching '}'
		foundMostRecent := false
		mostRecentVal := "0"
		depth := 1
		for depth > 0 {
			t2, ok := next()
			if !ok {
				break
			}
			if t2.kind == "brace" {
				switch t2.val {
				case "{":
					depth++
				case "}":
					depth--
				}
				continue
			}
			// t2 is a string -> key
			keyName := t2.val
			// read value token (string or brace)
			vtok, ok := next()
			if !ok {
				break
			}
			if vtok.kind == "brace" {
				// unexpected nested block; adjust depth and continue
				if vtok.val == "{" {
					depth++
				} else {
					depth--
				}
				continue
			}
			if equalFoldTrim(keyName, "MostRecent") {
				foundMostRecent = true
				mostRecentVal = trimWS(vtok.val)
			}
		}
		if foundMostRecent && (mostRecentVal == "1" || mostRecentVal == "true") {
			return steamID, nil
		}
		// else continue to next entry
	}

	return "", fmt.Errorf("no user with MostRecent = 1 found")
}

func stripVDFComments(s string) string {
	// Remove // comments till end of line
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); {
		// handle //
		if s[i] == '/' && i+1 < len(s) && s[i+1] == '/' {
			// skip to end of line
			i += 2
			for i < len(s) && s[i] != '\n' {
				i++
			}
			continue
		}
		out = append(out, s[i])
		i++
	}
	return string(out)
}

func equalFoldTrim(a, b string) bool { return strings.EqualFold(trimWS(a), trimWS(b)) }

func trimWS(s string) string {
	// lightweight trim for spaces and tabs and quotes if present
	// though quotes should already be removed by tokenizer
	i, j := 0, len(s)
	for i < j && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\r' || s[j-1] == '\n') {
		j--
	}
	return s[i:j]
}

package detect

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// SteamAccount returns the Steam ID and persona name of the MostRecent user in
// the Steam installation at steamDir by reading config/loginusers.vdf. It
// returns empty strings when the file is missing, malformed, or lists no
// users.
func SteamAccount(steamDir string) (steamID, personaName string) {
	steamDir = cleanDir(steamDir)
	if steamDir == "" {
		return "", ""
	}
	id, name, err := parseMostRecentUser(filepath.Join(steamDir, "config", "loginusers.vdf"))
	if err != nil {
		return "", ""
	}
	return id, name
}

// parseMostRecentUser parses the Valve KeyValues (VDF) loginusers file and returns
// the SteamID64 and PersonaName for the entry marked with MostRecent = 1.
// If no entry has MostRecent = 1, the first user entry is returned as a fallback.
func parseMostRecentUser(path string) (string, string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", "", err
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
			return "", "", fmt.Errorf("'users' section not found")
		}
		if t.kind == "str" && equalFoldTrim(t.val, "users") {
			break
		}
	}
	t, ok := next()
	if !ok || t.kind != "brace" || t.val != "{" {
		return "", "", fmt.Errorf("missing '{' after users")
	}

	// iterate over entries: "<steamid>" { kv }
	var fallbackID, fallbackName string
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
		// Remember the first user as a fallback in case no MostRecent entry is found.
		if fallbackID == "" {
			fallbackID = steamID
		}
		// parse block until matching '}'
		foundMostRecent := false
		mostRecentVal := "0"
		personaName := ""
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
			if equalFoldTrim(keyName, "PersonaName") {
				personaName = trimWS(vtok.val)
				if fallbackName == "" {
					fallbackName = personaName
				}
			}
		}
		if foundMostRecent && (mostRecentVal == "1" || mostRecentVal == "true") {
			return steamID, personaName, nil
		}
		// else continue to next entry
	}

	// No user with MostRecent = 1 was found. Fall back to the first user
	// encountered, which covers loginusers.vdf files that omit MostRecent.
	if fallbackID != "" {
		return fallbackID, fallbackName, nil
	}
	return "", "", fmt.Errorf("no users found in loginusers.vdf")
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

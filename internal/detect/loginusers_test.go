package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func writeLoginUsers(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "loginusers.vdf")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestParseMostRecentUser(t *testing.T) {
	const twoUsers = `"users"
{
	"76561198000000001"
	{
		"AccountName"		"first"
		"PersonaName"		"First User"
		"MostRecent"		"0"
	}
	"76561198000000002"
	{
		"AccountName"		"second"
		"PersonaName"		"Second User"
		"MostRecent"		"1"
	}
}
`

	tests := []struct {
		name      string
		content   string
		wantID    string
		wantName  string
		wantError bool
	}{
		{
			name:     "selects MostRecent user",
			content:  twoUsers,
			wantID:   "76561198000000002",
			wantName: "Second User",
		},
		{
			name: "falls back to the first user when none is marked",
			content: `"users"
{
	"76561198000000001"
	{
		"PersonaName"		"First User"
		"MostRecent"		"0"
	}
	"76561198000000002"
	{
		"PersonaName"		"Second User"
		"MostRecent"		"0"
	}
}
`,
			wantID:   "76561198000000001",
			wantName: "First User",
		},
		{
			name: "ignores comments",
			content: `// top level comment
"users" // trailing comment
{
	"76561198000000003"
	{
		// per-user comment
		"PersonaName"		"Commented User"
		"MostRecent"		"1"
	}
}
`,
			wantID:   "76561198000000003",
			wantName: "Commented User",
		},
		{
			name: "accepts boolean MostRecent",
			content: `"users"
{
	"76561198000000004"
	{
		"PersonaName"		"Boolean User"
		"MostRecent"		"true"
	}
}
`,
			wantID:   "76561198000000004",
			wantName: "Boolean User",
		},
		{
			name: "unescapes quotes in persona name",
			content: `"users"
{
	"76561198000000005"
	{
		"PersonaName"		"Say \"Hi\""
		"MostRecent"		"1"
	}
}
`,
			wantID:   "76561198000000005",
			wantName: `Say "Hi"`,
		},
		{
			name:      "missing users section",
			content:   `"libraryfolders" { "0" { "path" "x" } }`,
			wantError: true,
		},
		{
			name:      "users without a block",
			content:   `"users" "not-a-block"`,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, name, err := parseMostRecentUser(writeLoginUsers(t, tt.content))
			if tt.wantError {
				if err == nil {
					t.Fatalf("expected error, got (%q, %q)", id, name)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseMostRecentUser: %v", err)
			}
			if id != tt.wantID || name != tt.wantName {
				t.Fatalf("got (%q, %q), want (%q, %q)", id, name, tt.wantID, tt.wantName)
			}
		})
	}
}

func TestParseMostRecentUserMissingFile(t *testing.T) {
	if _, _, err := parseMostRecentUser(filepath.Join(t.TempDir(), "missing.vdf")); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestSteamAccountMissingDir(t *testing.T) {
	if id, name := SteamAccount(filepath.Join(t.TempDir(), "nope")); id != "" || name != "" {
		t.Fatalf("SteamAccount = (%q, %q), want empty", id, name)
	}
	if id, name := SteamAccount(""); id != "" || name != "" {
		t.Fatalf("SteamAccount(\"\") = (%q, %q), want empty", id, name)
	}
}

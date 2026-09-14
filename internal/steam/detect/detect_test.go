package detect

import (
	"os"
	"path/filepath"
	"testing"

	"refleks/internal/constants"
)

func TestUnescapeVDF(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{`C:\\Program Files\\Steam`, `C:\Program Files\Steam`},
		{`C:\Program Files\Steam`, `C:Program FilesSteam`},
		{`/home/user/Steam`, `/home/user/Steam`},
		{`/a\/b`, `/a/b`},
		{`trailing\`, `trailing\`},
		{``, ``},
	}
	for _, tt := range tests {
		if got := unescapeVDF(tt.in); got != tt.want {
			t.Errorf("unescapeVDF(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestLibraryFoldersFromVDF(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "libraryfolders.vdf")
	content := `"libraryfolders"
{
	"0"
	{
		"path"      "C:\\Program Files (x86)\\Steam"
	}
	"1"
	{
		"path"      "D:\\SteamLibrary"
	}
}
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	got := libraryFoldersFromVDF(path)
	want := []string{`C:\Program Files (x86)\Steam`, `D:\SteamLibrary`}
	if len(got) != len(want) {
		t.Fatalf("roots = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("root[%d] = %q, want %q", i, got[i], want[i])
		}
	}

	if got := libraryFoldersFromVDF(filepath.Join(dir, "missing.vdf")); got != nil {
		t.Errorf("missing file roots = %v, want nil", got)
	}
}

func TestSteamLibraryRoots(t *testing.T) {
	steamDir := t.TempDir()
	extra := t.TempDir()
	if err := os.MkdirAll(filepath.Join(steamDir, "steamapps"), 0o755); err != nil {
		t.Fatal(err)
	}
	vdf := "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"" + steamDir + "\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"" + extra + "\"\n\t}\n}\n"
	if err := os.WriteFile(filepath.Join(steamDir, "steamapps", "libraryfolders.vdf"), []byte(vdf), 0o600); err != nil {
		t.Fatal(err)
	}

	got := steamLibraryRoots(steamDir)
	if len(got) != 2 {
		t.Fatalf("roots = %v, want [steamDir extra]", got)
	}
	if got[0] != filepath.Clean(steamDir) || got[1] != filepath.Clean(extra) {
		t.Errorf("roots = %v, want [%q %q]", got, filepath.Clean(steamDir), filepath.Clean(extra))
	}

	if got := steamLibraryRoots(""); got != nil {
		t.Errorf("empty steam dir roots = %v, want nil", got)
	}
}

func TestKovaaksInstallDirInSteam(t *testing.T) {
	newLibrary := func(t *testing.T, withKovaaks bool) string {
		t.Helper()
		root := t.TempDir()
		if withKovaaks {
			// The game data directory lives next to the executable inside the
			// install dir, which is how isKovaaksInstallDir recognizes it.
			install := filepath.Join(root, "steamapps", "common", constants.KovaaksDataDirName)
			if err := os.MkdirAll(filepath.Join(install, constants.KovaaksDataDirName), 0o755); err != nil {
				t.Fatal(err)
			}
		}
		return root
	}

	t.Run("primary library", func(t *testing.T) {
		root := newLibrary(t, true)
		want := filepath.Join(root, "steamapps", "common", constants.KovaaksDataDirName)
		if got := KovaaksInstallDirInSteam(root); got != want {
			t.Errorf("KovaaksInstallDirInSteam = %q, want %q", got, want)
		}
	})

	t.Run("executable only", func(t *testing.T) {
		root := t.TempDir()
		install := filepath.Join(root, "steamapps", "common", constants.KovaaksDataDirName)
		if err := os.MkdirAll(install, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(install, constants.KovaaksProcessName), []byte("exe"), 0o600); err != nil {
			t.Fatal(err)
		}
		if got := KovaaksInstallDirInSteam(root); got != install {
			t.Errorf("KovaaksInstallDirInSteam = %q, want %q", got, install)
		}
	})

	t.Run("secondary library", func(t *testing.T) {
		steamDir := t.TempDir()
		extra := newLibrary(t, true)
		if err := os.MkdirAll(filepath.Join(steamDir, "steamapps"), 0o755); err != nil {
			t.Fatal(err)
		}
		vdf := "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"" + steamDir + "\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"" + extra + "\"\n\t}\n}\n"
		if err := os.WriteFile(filepath.Join(steamDir, "steamapps", "libraryfolders.vdf"), []byte(vdf), 0o600); err != nil {
			t.Fatal(err)
		}
		want := filepath.Join(extra, "steamapps", "common", constants.KovaaksDataDirName)
		if got := KovaaksInstallDirInSteam(steamDir); got != want {
			t.Errorf("KovaaksInstallDirInSteam = %q, want %q", got, want)
		}
	})

	t.Run("not installed", func(t *testing.T) {
		if got := KovaaksInstallDirInSteam(newLibrary(t, false)); got != "" {
			t.Errorf("KovaaksInstallDirInSteam = %q, want empty", got)
		}
		if got := KovaaksInstallDirInSteam(""); got != "" {
			t.Errorf("KovaaksInstallDirInSteam(empty) = %q, want empty", got)
		}
	})
}

func TestIsSteamDir(t *testing.T) {
	tests := []struct {
		name string
		mark string
		want bool
	}{
		{"steamapps marker", "steamapps", true},
		{"config marker", "config", true},
		{"no marker", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			if tt.mark != "" {
				if err := os.MkdirAll(filepath.Join(dir, tt.mark), 0o755); err != nil {
					t.Fatal(err)
				}
			}
			if got := isSteamDir(dir); got != tt.want {
				t.Errorf("isSteamDir = %v, want %v", got, tt.want)
			}
		})
	}
	if isSteamDir("") {
		t.Error("isSteamDir(\"\") = true, want false")
	}
}

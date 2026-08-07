package settings

import (
	"encoding/json"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func TestDefaultLanguageIsUninitialized(t *testing.T) {
	if got := Default().Language; got != "" {
		t.Fatalf("Default().Language = %q, want empty", got)
	}
}

func TestSettingsWithoutLanguageRemainUninitialized(t *testing.T) {
	loaded := Default()
	if err := json.Unmarshal([]byte(`{"sessionGapMinutes":45,"theme":"dark"}`), &loaded); err != nil {
		t.Fatal(err)
	}

	got := Sanitize(loaded)
	if got.Language != "" {
		t.Fatalf("Language = %q, want empty", got.Language)
	}
	if got.SessionGapMinutes != 45 {
		t.Fatalf("SessionGapMinutes = %d, want 45", got.SessionGapMinutes)
	}
}

func TestSanitizeLanguage(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "English", in: constants.LanguageEnglish, want: constants.LanguageEnglish},
		{name: "Simplified Chinese", in: constants.LanguageSimplifiedChinese, want: constants.LanguageSimplifiedChinese},
		{name: "trimmed", in: " zh-CN ", want: constants.LanguageSimplifiedChinese},
		{name: "system is not persisted", in: "system", want: ""},
		{name: "invalid", in: "fr", want: ""},
		{name: "empty", in: "", want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := Sanitize(models.Settings{Language: test.in}).Language
			if got != test.want {
				t.Fatalf("Sanitize(Language=%q) = %q, want %q", test.in, got, test.want)
			}
		})
	}
}

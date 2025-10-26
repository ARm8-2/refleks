package settings

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var envLoadOnce sync.Once

// GetEnv returns the environment variable for key. If not present, it attempts
// to load a .env file (from the app config dir, falling back to current working directory)
// once per process and then returns the value.
func GetEnv(key string) string {
	v := os.Getenv(key)
	if v != "" {
		return v
	}
	envLoadOnce.Do(func() {
		// Try $HOME/.refleks/.env
		if base, err := ConfigBaseDir(); err == nil {
			_ = loadDotEnv(filepath.Join(base, ".env"))
		}
		// Fallback: try CWD/.env for developer convenience
		if cwd, err := os.Getwd(); err == nil {
			_ = loadDotEnv(filepath.Join(cwd, ".env"))
		}
	})
	return os.Getenv(key)
}

func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" {
			continue
		}
		// comments: #, //, ;
		if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") || strings.HasPrefix(line, ";") {
			continue
		}
		// allow export FOO=bar syntax
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		eq := strings.IndexByte(line, '=')
		if eq <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		// strip surrounding quotes
		if len(val) >= 2 {
			if (val[0] == '\'' && val[len(val)-1] == '\'') || (val[0] == '"' && val[len(val)-1] == '"') {
				val = val[1 : len(val)-1]
			}
		}
		// Only set if not already provided by real environment
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
	return nil
}

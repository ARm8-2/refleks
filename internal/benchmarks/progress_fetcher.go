package benchmarks

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"refleks/internal/constants"
	"refleks/internal/steam"
)

// GetPlayerProgressRaw returns the raw player progress payload for one benchmark difficulty.
func (s *Service) GetPlayerProgressRaw(benchmarkID int) (string, error) {
	steamID := steam.GetSteamID(s.settingsSvc.Get())
	if steamID == "" {
		return "", errors.New("steam ID not found")
	}
	url := fmt.Sprintf(constants.KovaaksPlayerProgressURL, benchmarkID, steamID)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch player progress: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d from progress endpoint", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read progress response: %w", err)
	}
	return string(body), nil
}

package scenarios

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
	"refleks/internal/steam"
)

// Service manages scenario data fetching.
type Service struct {
	settingsSvc *settings.Service
}

// NewService creates a new scenario service.
func NewService(settingsSvc *settings.Service) *Service {
	return &Service{settingsSvc: settingsSvc}
}

// GetLastScores fetches the last 10 scores for a given scenario from KovaaK's API.
func (s *Service) GetLastScores(scenarioName string) ([]models.KovaaksLastScore, error) {
	personaName := steam.GetPersonaName(s.settingsSvc.Get())
	if personaName == "" {
		return nil, fmt.Errorf("could not determine Steam PersonaName")
	}

	endpoint := fmt.Sprintf(constants.KovaaksLastScoresURL, url.QueryEscape(personaName), url.QueryEscape(scenarioName))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status: %d", resp.StatusCode)
	}

	var scores []models.KovaaksLastScore
	if err := json.NewDecoder(resp.Body).Decode(&scores); err != nil {
		return nil, err
	}

	return scores, nil
}

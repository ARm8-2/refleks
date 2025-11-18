package models

type AIOptions struct {
	MaxRunsPerScenario int    `json:"maxRunsPerScenario"`
	SystemPersona      string `json:"systemPersona"`
}

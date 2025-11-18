package appsvc

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/ai"
	"refleks/internal/constants"
	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// AIService coordinates AI streaming requests and emits Wails events for the frontend.
type AIService struct {
	ctx      context.Context
	settings *models.Settings
	mu       sync.Mutex
	cancels  map[string]context.CancelFunc
}

func NewAIService(ctx context.Context, settings *models.Settings) *AIService {
	return &AIService{ctx: ctx, settings: settings, cancels: make(map[string]context.CancelFunc)}
}

// NewRequestID returns a unique ID for correlating streams on the frontend.
func (s *AIService) NewRequestID() string { return uuid.NewString() }

// GenerateSessionInsights starts a streaming generation for the given records and options.
// It emits events: AI:Session:Start, AI:Session:Delta, AI:Session:Done, AI:Session:Error
func (s *AIService) GenerateSessionInsights(reqID string, sessionID string, records []models.ScenarioRecord, prompt string, options models.AIOptions) {
	// Resolve API key: env override wins
	key := appsettings.GetEnv(constants.EnvGeminiAPIKeyVar)
	if key == "" && s.settings != nil {
		key = s.settings.GeminiAPIKey
	}
	if key == "" {
		runtime.EventsEmit(s.ctx, "AI:Session:Error", map[string]any{"requestId": reqID, "error": "Missing Gemini API key. Set it in Settings or REFLEKS_GEMINI_API_KEY."})
		return
	}
	input := ai.SessionInsightsInput{SessionID: sessionID, Records: records, Options: options, Prompt: prompt}
	system, user := ai.BuildSessionPrompt(input)
	client, err := ai.NewGeminiClient(s.ctx, key, "")
	if err != nil {
		runtime.EventsEmit(s.ctx, "AI:Session:Error", map[string]any{"requestId": reqID, "error": err.Error()})
		return
	}
	runtime.EventsEmit(s.ctx, "AI:Session:Start", map[string]any{"requestId": reqID, "sessionId": sessionID})
	ctx, cancel := context.WithCancel(s.ctx)
	s.mu.Lock()
	s.cancels[reqID] = cancel
	s.mu.Unlock()
	go func() {
		defer func() {
			_ = client.Close()
			s.mu.Lock()
			delete(s.cancels, reqID)
			s.mu.Unlock()
			runtime.EventsEmit(s.ctx, "AI:Session:Done", map[string]any{"requestId": reqID, "cached": false})
		}()
		err := client.StreamSessionInsights(ctx, system, user, func(text string) {
			runtime.EventsEmit(s.ctx, "AI:Session:Delta", map[string]any{"requestId": reqID, "text": text})
		})
		if err != nil && err != context.Canceled {
			runtime.EventsEmit(s.ctx, "AI:Session:Error", map[string]any{"requestId": reqID, "error": err.Error()})
		}
	}()
}

// Cancel cancels an in-flight request by ID.
func (s *AIService) Cancel(reqID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.cancels[reqID]; ok {
		c()
		delete(s.cancels, reqID)
	}
}

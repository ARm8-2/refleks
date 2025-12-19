package ai

import (
	"context"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// Service coordinates AI streaming requests and emits Wails events for the frontend.
type Service struct {
	ctx         context.Context
	settingsSvc *appsettings.Service
	mu          sync.Mutex
	cancels     map[string]context.CancelFunc
}

func NewService(ctx context.Context, settingsSvc *appsettings.Service) *Service {
	return &Service{ctx: ctx, settingsSvc: settingsSvc, cancels: make(map[string]context.CancelFunc)}
}

// NewRequestID returns a unique ID for correlating streams on the frontend.
func (s *Service) NewRequestID() string { return uuid.NewString() }

// GenerateSessionInsights starts a streaming generation for the given records and options.
// It emits events: AI:Session:Start, AI:Session:Delta, AI:Session:Done, AI:Session:Error
func (s *Service) GenerateSessionInsights(reqID string, sessionID string, records []models.ScenarioRecord, prompt string, options models.AIOptions) {
	// Resolve API key: env override wins
	key := appsettings.GetEnv(constants.EnvGeminiAPIKeyVar)
	if key == "" && s.settingsSvc != nil {
		key = s.settingsSvc.Get().GeminiAPIKey
	}
	if key == "" {
		runtime.EventsEmit(s.ctx, constants.EventAISessionError, map[string]any{"requestId": reqID, "error": "Missing Gemini API key. Set it in Settings or REFLEKS_GEMINI_API_KEY."})
		return
	}
	input := SessionInsightsInput{SessionID: sessionID, Records: records, Options: options, Prompt: prompt}
	system, user := BuildSessionPrompt(input)
	client, err := NewGeminiClient(s.ctx, key, "")
	if err != nil {
		runtime.EventsEmit(s.ctx, constants.EventAISessionError, map[string]any{"requestId": reqID, "error": err.Error()})
		return
	}
	runtime.EventsEmit(s.ctx, constants.EventAISessionStart, map[string]any{"requestId": reqID, "sessionId": sessionID})
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
			runtime.EventsEmit(s.ctx, constants.EventAISessionDone, map[string]any{"requestId": reqID, "cached": false})
		}()
		err := client.StreamSessionInsights(ctx, system, user, func(text string) {
			runtime.EventsEmit(s.ctx, constants.EventAISessionDelta, map[string]any{"requestId": reqID, "text": text})
		})
		if err != nil && err != context.Canceled {
			msg := err.Error()
			if strings.Contains(msg, "API key") || strings.Contains(msg, "400") || strings.Contains(msg, "403") {
				msg = "Failed to connect to Gemini. Please check your API key."
			}
			runtime.EventsEmit(s.ctx, constants.EventAISessionError, map[string]any{"requestId": reqID, "error": msg})
		}
	}()
}

// Cancel cancels an in-flight request by ID.
func (s *Service) Cancel(reqID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.cancels[reqID]; ok {
		c()
		delete(s.cancels, reqID)
	}
}

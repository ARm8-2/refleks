package ai

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"

	"refleks/internal/constants"
)

// GeminiClient wraps the Google Generative AI client and model configuration.
type GeminiClient struct {
	client *genai.Client
	model  string
}

// NewGeminiClient constructs a new client from an API key and optional model.
func NewGeminiClient(ctx context.Context, apiKey string, model string) (*GeminiClient, error) {
	if apiKey == "" {
		return nil, errors.New("missing Gemini API key")
	}
	c, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}
	if model == "" {
		model = constants.AIDefaultModel
	}
	return &GeminiClient{client: c, model: model}, nil
}

// Close releases underlying resources.
func (g *GeminiClient) Close() error {
	if g == nil || g.client == nil {
		return nil
	}
	return g.client.Close()
}

// StreamSessionInsights runs a streaming generation and calls onDelta for each text chunk.
func (g *GeminiClient) StreamSessionInsights(ctx context.Context, system string, user string, onDelta func(string)) error {
	if g == nil || g.client == nil {
		return fmt.Errorf("client not initialized")
	}
	model := g.client.GenerativeModel(g.model)
	// Provide system instruction & conservative, analysis‑oriented generation config
	model.SystemInstruction = &genai.Content{Parts: []genai.Part{genai.Text(system)}}
	model.GenerationConfig = genai.GenerationConfig{
		Temperature:     ptr[float32](0.2),
		TopK:            ptr[int32](32),
		TopP:            ptr[float32](0.95),
		MaxOutputTokens: ptr[int32](2048), // allow slightly longer structured analyses
	}
	// Stream the response given the user payload
	iter := model.GenerateContentStream(ctx, genai.Text(user))
	for {
		resp, err := iter.Next()
		if errors.Is(err, context.Canceled) {
			return err
		}
		if err != nil {
			if err == iterator.Done {
				return nil
			}
			return err
		}
		for _, c := range resp.Candidates {
			for _, p := range c.Content.Parts {
				if t, ok := p.(genai.Text); ok {
					onDelta(string(t))
				}
			}
		}
	}
}

// small helper for pointer literals
func ptr[T any](v T) *T { return &v }

package models

import "regexp"

var messageCodePattern = regexp.MustCompile(`^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$`)

type MessageParams map[string]any

type UserMessage struct {
	MessageCode   string        `json:"messageCode"`
	MessageParams MessageParams `json:"messageParams,omitempty"`
}

func NewUserMessage(code string, params MessageParams) UserMessage {
	if !messageCodePattern.MatchString(code) {
		panic("invalid user message code: " + code)
	}
	for _, value := range params {
		switch value.(type) {
		case string, bool, int, int8, int16, int32, int64,
			uint, uint8, uint16, uint32, uint64, float32, float64:
		default:
			panic("user message params must contain primitive values")
		}
	}
	return UserMessage{MessageCode: code, MessageParams: params}
}

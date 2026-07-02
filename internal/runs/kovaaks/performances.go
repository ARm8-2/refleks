package kovaaks

import (
	"fmt"
	"math"
	"os"

	"refleks/internal/models"

	"google.golang.org/protobuf/encoding/protowire"
)

func ParsePerformancesFile(path string) (*models.RunPerformanceData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	parsed, err := parsePerformancesMessage(data)
	if err != nil {
		return nil, fmt.Errorf("parse performances file %s: %w", path, err)
	}
	return parsed, nil
}

func parsePerformancesMessage(data []byte) (*models.RunPerformanceData, error) {
	result := &models.RunPerformanceData{}
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return nil, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			header, err := parsePerformanceHeader(msg)
			if err != nil {
				return nil, err
			}
			result.Header = header
			data = data[n:]
		case 2:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			event, err := parsePerformanceEvent(msg)
			if err != nil {
				return nil, err
			}
			result.Events = append(result.Events, event)
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return result, nil
}

func parsePerformanceHeader(data []byte) (models.RunPerformanceHeader, error) {
	var header models.RunPerformanceHeader
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return header, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ScenarioName = value
			data = data[n:]
		case 2:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ScenarioHash = value
			data = data[n:]
		case 3:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.ChallengeStartUTC = int64(value)
			data = data[n:]
		case 4:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			header.SchemaVersion = uint32(value)
			data = data[n:]
		case 5:
			msg, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			profile, err := parseChallengeProfileSnapshot(msg)
			if err != nil {
				return header, err
			}
			header.ChallengeProfile = profile
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return header, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return header, nil
}

func parseChallengeProfileSnapshot(data []byte) (models.ChallengeProfileSnapshot, error) {
	var profile models.ChallengeProfileSnapshot
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return profile, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.TimeLimit = math.Float32frombits(value)
			data = data[n:]
		case 2:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerProfile = value
			data = data[n:]
		case 3:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.AddedBots = append(profile.AddedBots, value)
			data = data[n:]
		case 4:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerMaxLives = int32(value)
			data = data[n:]
		case 5:
			values, n, err := consumePackedOrScalarInt32s(data, wireType)
			if err != nil {
				return profile, err
			}
			profile.BotMaxLives = append(profile.BotMaxLives, values...)
			data = data[n:]
		case 6:
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.PlayerTeam = int32(value)
			data = data[n:]
		case 7:
			values, n, err := consumePackedOrScalarInt32s(data, wireType)
			if err != nil {
				return profile, err
			}
			profile.BotTeams = append(profile.BotTeams, values...)
			data = data[n:]
		case 8:
			value, n := protowire.ConsumeString(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.MapName = value
			data = data[n:]
		case 9:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.MapScale = math.Float32frombits(value)
			data = data[n:]
		case 10:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.Timescale = math.Float32frombits(value)
			data = data[n:]
		case 11:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.EndChallengeAfterKills = math.Float32frombits(value)
			data = data[n:]
		case 12:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			profile.EndChallengeAfterDamage = math.Float32frombits(value)
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return profile, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return profile, nil
}

func parsePerformanceEvent(data []byte) (models.RunPerformanceEvent, error) {
	var event models.RunPerformanceEvent
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return event, protowire.ParseError(consumed)
		}
		data = data[consumed:]

		switch fieldNum {
		case 1:
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return event, protowire.ParseError(n)
			}
			event.Timestamp = math.Float32frombits(value)
			data = data[n:]
		case 2, 3, 4, 8, 9, 10, 12, 13:
			count, n, err := parseCountMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Count = &count
			data = data[n:]
		case 5, 6, 7, 11, 14, 15:
			delta, n, err := parseFloatValueMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Delta = &delta
			data = data[n:]
		case 16, 17, 18:
			value, n, err := parseFloatValueMessage(data)
			if err != nil {
				return event, err
			}
			event.PayloadType = performancePayloadType(fieldNum)
			event.Value = &value
			data = data[n:]
		default:
			n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
			if n < 0 {
				return event, protowire.ParseError(n)
			}
			data = data[n:]
		}
	}
	return event, nil
}

func parseCountMessage(data []byte) (int32, int, error) {
	msg, n := protowire.ConsumeBytes(data)
	if n < 0 {
		return 0, 0, protowire.ParseError(n)
	}
	value, err := parseEmbeddedInt32Field(msg, 1)
	if err != nil {
		return 0, 0, err
	}
	return value, n, nil
}

func parseFloatValueMessage(data []byte) (float32, int, error) {
	msg, n := protowire.ConsumeBytes(data)
	if n < 0 {
		return 0, 0, protowire.ParseError(n)
	}
	value, err := parseEmbeddedFloat32Field(msg, 1)
	if err != nil {
		return 0, 0, err
	}
	return value, n, nil
}

func parseEmbeddedInt32Field(data []byte, wantField protowire.Number) (int32, error) {
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return 0, protowire.ParseError(consumed)
		}
		data = data[consumed:]
		if fieldNum == wantField {
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return 0, protowire.ParseError(n)
			}
			return int32(value), nil
		}
		n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
		if n < 0 {
			return 0, protowire.ParseError(n)
		}
		data = data[n:]
	}
	return 0, nil
}

func parseEmbeddedFloat32Field(data []byte, wantField protowire.Number) (float32, error) {
	for len(data) > 0 {
		fieldNum, wireType, consumed := protowire.ConsumeTag(data)
		if consumed < 0 {
			return 0, protowire.ParseError(consumed)
		}
		data = data[consumed:]
		if fieldNum == wantField {
			value, n := protowire.ConsumeFixed32(data)
			if n < 0 {
				return 0, protowire.ParseError(n)
			}
			return math.Float32frombits(value), nil
		}
		n := protowire.ConsumeFieldValue(fieldNum, wireType, data)
		if n < 0 {
			return 0, protowire.ParseError(n)
		}
		data = data[n:]
	}
	return 0, nil
}

func consumePackedOrScalarInt32s(data []byte, wireType protowire.Type) ([]int32, int, error) {
	if wireType == protowire.BytesType {
		payload, n := protowire.ConsumeBytes(data)
		if n < 0 {
			return nil, 0, protowire.ParseError(n)
		}
		values := make([]int32, 0)
		for len(payload) > 0 {
			value, consumed := protowire.ConsumeVarint(payload)
			if consumed < 0 {
				return nil, 0, protowire.ParseError(consumed)
			}
			values = append(values, int32(value))
			payload = payload[consumed:]
		}
		return values, n, nil
	}
	value, n := protowire.ConsumeVarint(data)
	if n < 0 {
		return nil, 0, protowire.ParseError(n)
	}
	return []int32{int32(value)}, n, nil
}

func performancePayloadType(fieldNum protowire.Number) string {
	switch fieldNum {
	case 2:
		return "shotsFired"
	case 3:
		return "shotsHit"
	case 4:
		return "shotsMissed"
	case 5:
		return "damageDone"
	case 6:
		return "damagePossible"
	case 7:
		return "score"
	case 8:
		return "kills"
	case 9:
		return "deaths"
	case 10:
		return "overshots"
	case 11:
		return "playerDamageTaken"
	case 12:
		return "reloads"
	case 13:
		return "pauseCount"
	case 14:
		return "distanceTraveled"
	case 15:
		return "mbsPoints"
	case 16:
		return "targetSize"
	case 17:
		return "targetSpeed"
	case 18:
		return "randomSensScale"
	default:
		return ""
	}
}

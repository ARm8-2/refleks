//go:build !windows

package environment

import (
	"time"

	"refleks/internal/models"
)

func collectPlatformEnvironment(env *models.RunEnvironment, start, end time.Time) {
	_ = env
	_ = start
	_ = end
}

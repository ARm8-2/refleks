package benchmarks

import (
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func (s *Service) rebuildScenarioIndexLocked() {
	s.scenarioIndex = make(map[string][]int)
	for benchmarkID, progress := range s.progressCache {
		for _, category := range progress.Categories {
			for _, group := range category.Groups {
				for _, scenario := range group.Scenarios {
					name := strings.ToLower(scenario.Name)
					found := false
					for _, existingID := range s.scenarioIndex[name] {
						if existingID == benchmarkID {
							found = true
							break
						}
					}
					if !found {
						s.scenarioIndex[name] = append(s.scenarioIndex[name], benchmarkID)
					}
				}
			}
		}
	}
}

func (s *Service) saveCacheLocked() error {
	s.rebuildScenarioIndexLocked()
	return s.cacheSvc.Save(constants.BenchmarkProgressCacheFileName, s.progressCache)
}

func (s *Service) loadCacheLocked() (map[int]models.BenchmarkProgress, error) {
	if !s.cacheSvc.Exists(constants.BenchmarkProgressCacheFileName) {
		return make(map[int]models.BenchmarkProgress), nil
	}

	var data map[int]models.BenchmarkProgress
	if err := s.cacheSvc.Load(constants.BenchmarkProgressCacheFileName, &data); err != nil {
		return nil, err
	}

	s.progressCache = data
	s.rebuildScenarioIndexLocked()
	return data, nil
}

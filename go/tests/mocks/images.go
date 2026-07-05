package mocks

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// ExerciseImagesDir is where BuildExerciseImageIndex looks for exercise PNGs.
// Override via PHYSIO_EXERCISE_IMAGES_DIR when running mocks / backfill tools
// in an environment where l8files lives elsewhere.
var ExerciseImagesDir = "/data/l8files/exercise-images/1"

var (
	imageIndexOnce sync.Once
	imageIndex     map[string]string // normalizedName -> absolute filesystem path
)

// numericPrefix strips the leading "NNN - " that batch-uploaded images use.
var numericPrefix = regexp.MustCompile(`^\d+\s*-\s*`)

// normalizeExerciseName collapses cosmetic differences between DB names and
// filenames: em-dashes, slashes, spacing, case. Non-alnum chars are dropped
// so "90/90 Hip Rotations" and "90 - 90 Hip Rotations" both key to
// "9090hiprotations".
func normalizeExerciseName(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// BuildExerciseImageIndex scans ExerciseImagesDir once and returns a map from
// normalized exercise name to full storage path. Empty map on any error — the
// callers just skip populating ImageStoragePath when no match is found.
func BuildExerciseImageIndex() map[string]string {
	imageIndexOnce.Do(func() {
		if v := os.Getenv("PHYSIO_EXERCISE_IMAGES_DIR"); v != "" {
			ExerciseImagesDir = v
		}
		imageIndex = make(map[string]string)
		entries, err := os.ReadDir(ExerciseImagesDir)
		if err != nil {
			return
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			ext := filepath.Ext(name)
			if strings.ToLower(ext) != ".png" {
				continue
			}
			stem := strings.TrimSuffix(name, ext)
			stem = numericPrefix.ReplaceAllString(stem, "")
			key := normalizeExerciseName(stem)
			if key == "" {
				continue
			}
			// First match wins; ignore duplicates (rare, but safe).
			if _, ok := imageIndex[key]; !ok {
				imageIndex[key] = filepath.Join(ExerciseImagesDir, name)
			}
		}
	})
	return imageIndex
}

// LookupImagePath returns the storage path for an exercise name, or "" if no
// matching image was found.
func LookupImagePath(exerciseName string) string {
	if exerciseName == "" {
		return ""
	}
	return BuildExerciseImageIndex()[normalizeExerciseName(exerciseName)]
}

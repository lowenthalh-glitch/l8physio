package mocks

import (
	"fmt"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// physioVideoURLs contains sample YouTube URLs for physiotherapy exercise demonstrations.
// These are real publicly-available physio exercise videos suitable for patient education.
var physioVideoURLs = []string{
	"https://www.youtube.com/watch?v=2pLT-olgUJs", // Knee exercises
	"https://www.youtube.com/watch?v=qN1bMhgW5aA", // Shoulder mobility
	"https://www.youtube.com/watch?v=sTxC3J3gQEU", // Hip strengthening
	"https://www.youtube.com/watch?v=XdMbFD8BhcM", // Lower back exercises
	"https://www.youtube.com/watch?v=OB4UBa7frG8", // Core stability
	"https://www.youtube.com/watch?v=IODxDxX7oi4", // Balance training
	"https://www.youtube.com/watch?v=g_tea8AbzEw", // Ankle rehab
	"https://www.youtube.com/watch?v=dDKRrxkbT_0", // Posture correction
	"https://www.youtube.com/watch?v=5MaT9nG5boc", // Thoracic mobility
	"https://www.youtube.com/watch?v=Tw_IpHPAUQI", // Glute strengthening
	"https://www.youtube.com/watch?v=_rbOnMETgO0", // Stretching routine
	"https://www.youtube.com/watch?v=hFYygmybON4", // Resistance band
	"https://www.youtube.com/watch?v=FN5SUhFGaOc", // Functional movement
	"https://www.youtube.com/watch?v=lbozu0DPcYI", // Breathing exercises
	"https://www.youtube.com/watch?v=8LhsrHD8zvM", // Neck mobility
}

func pickVideoURL(i int) string {
	return physioVideoURLs[i%len(physioVideoURLs)]
}

type exerciseDef struct {
	name     string
	category physio.PhysioExerciseCategory
	region   physio.PhysioBodyRegion
	sets     int32
	reps     int32
	hold     int32
}

// allExerciseDefs combines all exercise categories into one slice for generation
var allExerciseDefs = []exerciseDef{
	// Strength
	{strengthExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_KNEE, 3, 15, 0},
	{strengthExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP, 3, 20, 2},
	{strengthExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ANKLE, 3, 15, 0},
	{strengthExercises[3], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_SHOULDER, 3, 12, 0},
	{strengthExercises[4], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ELBOW, 3, 12, 0},
	{strengthExercises[5], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_KNEE, 3, 15, 5},
	{strengthExercises[6], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_UPPER_BACK, 3, 15, 0},
	{strengthExercises[7], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP, 3, 15, 2},
	// Flexibility
	{flexibilityExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_LOWER_BACK, 3, 1, 30},
	{flexibilityExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP, 3, 1, 30},
	{flexibilityExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_SHOULDER, 3, 1, 30},
	{flexibilityExercises[3], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_NECK, 3, 10, 5},
	{flexibilityExercises[4], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP, 3, 1, 30},
	{flexibilityExercises[5], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ANKLE, 3, 1, 30},
	{flexibilityExercises[6], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_UPPER_BACK, 3, 10, 5},
	// Balance
	{balanceExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ANKLE, 3, 1, 30},
	{balanceExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 3, 1, 60},
	{balanceExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 3, 1, 60},
	{balanceExercises[3], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_CORE, 3, 1, 60},
	{balanceExercises[4], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 2, 1, 0},
	// Cardio
	{cardioExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_CARDIO, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 1, 1, 0},
	{cardioExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_CARDIO, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 1, 1, 0},
	{cardioExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_CARDIO, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 1, 1, 0},
	{cardioExercises[3], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_CARDIO, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY, 1, 1, 0},
	// Mobility
	{mobilityExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_SHOULDER, 3, 20, 0},
	{mobilityExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ANKLE, 3, 20, 0},
	{mobilityExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_WRIST, 3, 20, 0},
	{mobilityExercises[3], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_NECK, 3, 15, 0},
	{mobilityExercises[4], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP, 3, 20, 0},
	{mobilityExercises[5], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_UPPER_BACK, 3, 15, 0},
	// Breathing
	{breathingExercises[0], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BREATHING, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_CORE, 3, 10, 0},
	{breathingExercises[1], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BREATHING, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_CORE, 3, 10, 0},
	{breathingExercises[2], physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BREATHING, physio.PhysioBodyRegion_PHYSIO_BODY_REGION_CORE, 3, 10, 0},
}

// generatePhysioExercises creates exercise records covering all categories
func generatePhysioExercises() []*physio.PhysioExercise {
	exercises := make([]*physio.PhysioExercise, len(allExerciseDefs))

	for i, def := range allExerciseDefs {
		exercises[i] = &physio.PhysioExercise{
			ExerciseId:         lm.GenID("ex", i),
			Name:               def.name,
			Description:        fmt.Sprintf("A %s exercise targeting the %s region.", def.category.String(), def.region.String()),
			Category:           def.category,
			BodyRegion:         def.region,
			DefaultSets:        def.sets,
			DefaultReps:        def.reps,
			DefaultHoldSeconds: def.hold,
			Instructions:       fmt.Sprintf("Perform %d sets of %d repetitions. Maintain correct posture throughout.", def.sets, def.reps),
			Contraindications:  "Do not perform if experiencing acute pain. Consult therapist before proceeding.",
			VideoStoragePath:   pickVideoURL(i),
			IsActive:           true,
			AuditInfo:          lm.CreateAuditInfo(),
		}
	}

	return exercises
}

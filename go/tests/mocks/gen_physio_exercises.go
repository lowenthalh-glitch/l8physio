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
	name       string
	categories []physio.PhysioExerciseCategory
	joints     []physio.PhysioJoint
	region     physio.PhysioBodyRegion
	sets       int32
	reps       int32
	hold       int32
}

// Shorthand aliases for readability
var (
	catStrength    = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH
	catFlexibility = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FLEXIBILITY
	catBalance     = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BALANCE
	catCardio      = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_CARDIO
	catMobility    = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY
	catBreathing   = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_BREATHING
	catRehab       = physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_REHAB

	jKnee      = physio.PhysioJoint_PHYSIO_JOINT_KNEE
	jHip       = physio.PhysioJoint_PHYSIO_JOINT_HIP
	jAnkle     = physio.PhysioJoint_PHYSIO_JOINT_ANKLE
	jShoulder  = physio.PhysioJoint_PHYSIO_JOINT_SHOULDER
	jElbow     = physio.PhysioJoint_PHYSIO_JOINT_ELBOW
	jLowerBack = physio.PhysioJoint_PHYSIO_JOINT_LOWER_BACK
	jCore      = physio.PhysioJoint_PHYSIO_JOINT_CORE
	jGeneral   = physio.PhysioJoint_PHYSIO_JOINT_GENERAL
	jSIJ       = physio.PhysioJoint_PHYSIO_JOINT_SIJ

	rKnee      = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_KNEE
	rHip       = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_HIP
	rAnkle     = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ANKLE
	rShoulder  = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_SHOULDER
	rElbow     = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_ELBOW
	rLowerBack = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_LOWER_BACK
	rUpperBack = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_UPPER_BACK
	rNeck      = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_NECK
	rWrist     = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_WRIST
	rCore      = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_CORE
	rFullBody  = physio.PhysioBodyRegion_PHYSIO_BODY_REGION_FULL_BODY
)

// allExerciseDefs combines all exercise categories into one slice for generation.
// Some exercises have multiple joints/categories to test the multi-joint feature.
var allExerciseDefs = []exerciseDef{
	// Strength
	{strengthExercises[0], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jKnee}, rKnee, 3, 15, 0},
	{strengthExercises[1], []physio.PhysioExerciseCategory{catStrength, catRehab}, []physio.PhysioJoint{jHip, jLowerBack}, rHip, 3, 20, 2},
	{strengthExercises[2], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jAnkle}, rAnkle, 3, 15, 0},
	{strengthExercises[3], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jShoulder}, rShoulder, 3, 12, 0},
	{strengthExercises[4], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jElbow}, rElbow, 3, 12, 0},
	{strengthExercises[5], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jKnee}, rKnee, 3, 15, 5},
	{strengthExercises[6], []physio.PhysioExerciseCategory{catStrength}, []physio.PhysioJoint{jShoulder, jLowerBack}, rUpperBack, 3, 15, 0},
	{strengthExercises[7], []physio.PhysioExerciseCategory{catStrength, catRehab}, []physio.PhysioJoint{jHip}, rHip, 3, 15, 2},
	// Flexibility
	{flexibilityExercises[0], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jLowerBack}, rLowerBack, 3, 1, 30},
	{flexibilityExercises[1], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jHip}, rHip, 3, 1, 30},
	{flexibilityExercises[2], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jShoulder}, rShoulder, 3, 1, 30},
	{flexibilityExercises[3], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jGeneral}, rNeck, 3, 10, 5},
	{flexibilityExercises[4], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jHip, jLowerBack}, rHip, 3, 1, 30},
	{flexibilityExercises[5], []physio.PhysioExerciseCategory{catFlexibility}, []physio.PhysioJoint{jAnkle}, rAnkle, 3, 1, 30},
	{flexibilityExercises[6], []physio.PhysioExerciseCategory{catFlexibility, catMobility}, []physio.PhysioJoint{jShoulder, jLowerBack}, rUpperBack, 3, 10, 5},
	// Balance
	{balanceExercises[0], []physio.PhysioExerciseCategory{catBalance}, []physio.PhysioJoint{jAnkle}, rAnkle, 3, 1, 30},
	{balanceExercises[1], []physio.PhysioExerciseCategory{catBalance}, []physio.PhysioJoint{jGeneral}, rFullBody, 3, 1, 60},
	{balanceExercises[2], []physio.PhysioExerciseCategory{catBalance}, []physio.PhysioJoint{jGeneral}, rFullBody, 3, 1, 60},
	{balanceExercises[3], []physio.PhysioExerciseCategory{catBalance}, []physio.PhysioJoint{jCore, jLowerBack}, rCore, 3, 1, 60},
	{balanceExercises[4], []physio.PhysioExerciseCategory{catBalance}, []physio.PhysioJoint{jGeneral}, rFullBody, 2, 1, 0},
	// Cardio
	{cardioExercises[0], []physio.PhysioExerciseCategory{catCardio}, []physio.PhysioJoint{jGeneral}, rFullBody, 1, 1, 0},
	{cardioExercises[1], []physio.PhysioExerciseCategory{catCardio}, []physio.PhysioJoint{jGeneral}, rFullBody, 1, 1, 0},
	{cardioExercises[2], []physio.PhysioExerciseCategory{catCardio}, []physio.PhysioJoint{jGeneral}, rFullBody, 1, 1, 0},
	{cardioExercises[3], []physio.PhysioExerciseCategory{catCardio}, []physio.PhysioJoint{jGeneral}, rFullBody, 1, 1, 0},
	// Mobility
	{mobilityExercises[0], []physio.PhysioExerciseCategory{catMobility}, []physio.PhysioJoint{jShoulder}, rShoulder, 3, 20, 0},
	{mobilityExercises[1], []physio.PhysioExerciseCategory{catMobility}, []physio.PhysioJoint{jAnkle}, rAnkle, 3, 20, 0},
	{mobilityExercises[2], []physio.PhysioExerciseCategory{catMobility}, []physio.PhysioJoint{jElbow}, rWrist, 3, 20, 0},
	{mobilityExercises[3], []physio.PhysioExerciseCategory{catMobility}, []physio.PhysioJoint{jGeneral}, rNeck, 3, 15, 0},
	{mobilityExercises[4], []physio.PhysioExerciseCategory{catMobility}, []physio.PhysioJoint{jHip, jSIJ}, rHip, 3, 20, 0},
	{mobilityExercises[5], []physio.PhysioExerciseCategory{catMobility, catFlexibility}, []physio.PhysioJoint{jShoulder, jLowerBack}, rUpperBack, 3, 15, 0},
	// Breathing
	{breathingExercises[0], []physio.PhysioExerciseCategory{catBreathing}, []physio.PhysioJoint{jCore}, rCore, 3, 10, 0},
	{breathingExercises[1], []physio.PhysioExerciseCategory{catBreathing}, []physio.PhysioJoint{jCore}, rCore, 3, 10, 0},
	{breathingExercises[2], []physio.PhysioExerciseCategory{catBreathing}, []physio.PhysioJoint{jCore}, rCore, 3, 10, 0},
}

// generatePhysioExercises creates exercise records covering all categories
func generatePhysioExercises() []*physio.PhysioExercise {
	exercises := make([]*physio.PhysioExercise, len(allExerciseDefs))

	for i, def := range allExerciseDefs {
		exercises[i] = &physio.PhysioExercise{
			ExerciseId:         lm.GenID("ex", i),
			Name:               def.name,
			Description:        fmt.Sprintf("A %s exercise targeting the %s region.", def.categories[0].String(), def.region.String()),
			Category:           def.categories[0],
			Categories:         def.categories,
			Joint:              def.joints[0],
			Joints:             def.joints,
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

	// Link progression/regression chains within each category
	linkProgressionRegression(exercises)

	return exercises
}

// linkProgressionRegression sets progression/regression references for exercises
// in the same category. Within each category group, exercise[i] progresses to
// exercise[i+1] and regresses to exercise[i-1].
func linkProgressionRegression(exercises []*physio.PhysioExercise) {
	// Group exercise indices by primary category (first in the list)
	byCategory := map[physio.PhysioExerciseCategory][]int{}
	for i, ex := range exercises {
		if len(ex.Categories) > 0 {
			byCategory[ex.Categories[0]] = append(byCategory[ex.Categories[0]], i)
		} else {
			byCategory[ex.Category] = append(byCategory[ex.Category], i)
		}
	}

	for _, indices := range byCategory {
		if len(indices) < 2 {
			continue
		}
		for pos, idx := range indices {
			if pos < len(indices)-1 {
				exercises[idx].ProgressionExerciseId = exercises[indices[pos+1]].ExerciseId
			}
			if pos > 0 {
				exercises[idx].RegressionExerciseId = exercises[indices[pos-1]].ExerciseId
			}
		}
	}
}

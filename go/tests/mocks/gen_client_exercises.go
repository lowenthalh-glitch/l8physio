package mocks

import (
	"github.com/saichler/l8physio/go/types/physio"
)

// generateClientExercises returns the exercises from the client's protocols.xlsx,
// translated from Hebrew and enriched with classification data for the protocol builder.
func generateClientExercises() []*physio.PhysioExercise {
	type exDef struct {
		name, description, aim, equipment string
		category                          physio.PhysioExerciseCategory
		joint                             physio.PhysioJoint
		posture                           physio.PhysioPosture
		phase                             physio.PhysioPhase
		exType                            physio.PhysioExerciseType
		loadType                          physio.PhysioLoadType
		effort                            string
		sets, reps                        int32
	}

	mob := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY
	rehab := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_REHAB
	strength := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH
	functional := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FUNCTIONAL

	shoulder := physio.PhysioJoint_PHYSIO_JOINT_SHOULDER
	knee := physio.PhysioJoint_PHYSIO_JOINT_KNEE
	ankle := physio.PhysioJoint_PHYSIO_JOINT_ANKLE
	hip := physio.PhysioJoint_PHYSIO_JOINT_HIP
	core := physio.PhysioJoint_PHYSIO_JOINT_CORE
	lbp := physio.PhysioJoint_PHYSIO_JOINT_LOWER_BACK
	general := physio.PhysioJoint_PHYSIO_JOINT_GENERAL

	kyph := physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS
	lord := physio.PhysioPosture_PHYSIO_POSTURE_LORDOSIS
	valg := physio.PhysioPosture_PHYSIO_POSTURE_VALGUS
	pron := physio.PhysioPosture_PHYSIO_POSTURE_PRONATION
	gen := physio.PhysioPosture_PHYSIO_POSTURE_GENERAL

	p1 := physio.PhysioPhase_PHYSIO_PHASE_1
	p2 := physio.PhysioPhase_PHYSIO_PHASE_2
	p3 := physio.PhysioPhase_PHYSIO_PHASE_3

	fixed := physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_FIXED
	variable := physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_VARIABLE

	bw := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BODYWEIGHT
	bandLight := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_LIGHT
	bandMed := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_MEDIUM

	defs := []exDef{
		// Hip & Lower Back / Core
		{"PPT with Ball Squeeze",
			"Pelvic tilts lying on back with knees bent, squeezing a ball. Inhale tilting back, exhale to neutral.",
			"Posterior pelvic tilt activation, core stability", "Ball",
			mob, lbp, lord, p1, fixed, bw, "5-6", 3, 15},
		{"PPT Crunches with Ball Squeeze",
			"Lying on back, hold PPT statically while squeezing ball. Half crunch lifting shoulder blades upward, not forward.",
			"Core activation with lumbar stabilisation", "Ball",
			rehab, core, lord, p1, fixed, bw, "5-6", 3, 12},
		{"PPT Shoulder Flexion with Ball Squeeze",
			"Lying on back, hold PPT while squeezing ball. Arms sweep overhead with dumbbells while inhaling, return while exhaling. Keep lower back pressed to mat.",
			"Serratus and shoulder flexion under core load", "Ball, light dumbbells",
			rehab, shoulder, kyph, p2, fixed, bandLight, "5-6", 3, 10},
		{"Scapular Setting – V",
			"Prone lying, arms in V shape; retract and depress shoulder blades.",
			"Lower trapezius and mid trapezius activation", "",
			rehab, shoulder, kyph, p1, fixed, bw, "5-6", 3, 12},
		{"Scapular Setting – T",
			"Prone lying, arms at 90° (T shape); retract and depress shoulder blades.",
			"Mid trapezius and rhomboid activation", "",
			rehab, shoulder, kyph, p1, variable, bw, "5-6", 3, 12},
		{"Scapular Setting – Y",
			"Prone lying, arms overhead in Y shape; retract and depress shoulder blades.",
			"Lower trapezius activation and thoracic extension", "",
			rehab, shoulder, kyph, p2, variable, bw, "6-7", 3, 10},
		{"TRX Row – Narrow Grip",
			"TRX rows pulling toward chest with narrow neutral grip.",
			"Scapular retraction and mid-back strength", "TRX",
			strength, shoulder, kyph, p2, fixed, bw, "7-8", 3, 10},
		{"TRX Row – Wide Grip",
			"TRX rows pulling toward chest with wide grip.",
			"Rhomboid and posterior deltoid activation", "TRX",
			strength, shoulder, kyph, p2, variable, bw, "7-8", 3, 10},
		// Ankle
		{"Calf Raises",
			"Standing calf raises onto toes. Can progress to single-leg.",
			"Plantar flexor strength and motor control", "",
			rehab, ankle, pron, p2, fixed, bw, "6-7", 3, 15},
		{"Plantar Flexion with Band",
			"Seated, band around foot; resist into plantar flexion.",
			"Ankle plantar flexor strength", "Band",
			rehab, ankle, pron, p1, variable, bandLight, "5-6", 3, 15},
		{"Dorsiflexion with Band",
			"Seated, band resists dorsiflexion; pull foot toward shin.",
			"Tibialis anterior strengthening", "Band",
			rehab, ankle, pron, p1, variable, bandLight, "5-6", 3, 15},
		{"Toe Taps",
			"Standing on heels, lift toes off floor.",
			"Tibialis anterior activation and balance training", "",
			rehab, ankle, pron, p1, fixed, bw, "5-6", 3, 15},
		// Knee
		{"Wall Squat – Medial Head",
			"Wall squat with ball squeezed between knees to activate VMO.",
			"VMO and medial quadriceps activation", "Ball, wall",
			rehab, knee, valg, p1, fixed, bw, "5-6", 3, 45},
		{"Wall Squat – Lateral Head",
			"Wall squat with resistance band above knee joint to resist valgus.",
			"Gluteus medius and lateral quad activation", "Band, wall",
			rehab, knee, valg, p2, variable, bandLight, "6-7", 3, 45},
		{"Adductor Stretch",
			"Standing wide stance (sumo), weight shifts side to side.",
			"Adductor flexibility and hip mobility", "",
			mob, knee, valg, p1, fixed, bw, "5-6", 2, 30},
		{"Hamstring Curls with Band",
			"Standing, band around ankles; curl one leg up toward glutes.",
			"Hamstring strengthening and knee flexor control", "Band",
			rehab, knee, valg, p2, variable, bandLight, "6-7", 3, 12},
		{"Hip Thrust with Ball Squeeze",
			"Supine with upper back on bench, squeeze ball between knees, drive hips up.",
			"Glute activation with adductor co-contraction", "Bench, ball",
			strength, knee, valg, p2, fixed, bw, "7-8", 3, 12},
		{"Clam Shell",
			"Side-lying, feet together, rotate top knee open like a clam. Band optional.",
			"Gluteus medius activation and external hip rotation", "Optional band",
			rehab, knee, valg, p1, fixed, bandLight, "5-6", 3, 15},
		{"Side Walk with Band",
			"Walk laterally with band above ankles, keeping knees straight.",
			"Hip abductor strengthening and dynamic valgus control", "Band",
			rehab, knee, valg, p2, fixed, bandMed, "6-7", 3, 15},
		{"Knee Flexion–Extension Slides",
			"Supine, heel slides along mat: flex then extend knee.",
			"Knee ROM restoration and quad/hamstring activation", "Smooth surface or slider",
			mob, knee, valg, p1, fixed, bw, "5-6", 3, 15},
		{"Knee Extension – Seated on Box",
			"Sitting on box, wedge under pelvis, kettlebell on foot; extend knee.",
			"Terminal knee extension and VMO strengthening", "Box, kettlebell, wedge",
			strength, knee, valg, p2, variable, bw, "6-7", 3, 12},
		{"Single-Leg Jumps",
			"Jump from cushion to step/box to box, landing softly each time.",
			"Single-leg power, proprioception and landing mechanics", "Step, box, cushion",
			functional, knee, valg, p3, variable, bw, "8-9", 3, 8},
		// Hip Thrust Variations
		{"Hip Thrust – Both Legs on Box",
			"Supine, both feet elevated on box, drive hips to full extension.",
			"Glute strength with elevated foot position", "Bench/box",
			strength, hip, lord, p2, variable, bw, "7-8", 3, 12},
		{"Hip Thrust – Both Legs on Physio Ball",
			"Supine, both feet on physio ball, drive hips up.",
			"Glute strength with unstable base", "Physio ball",
			strength, hip, lord, p2, variable, bw, "7-8", 3, 12},
		{"Hip Thrust – Single Leg on Yoga Block",
			"Supine, one foot on yoga block, single-leg hip thrust.",
			"Unilateral glute strength", "Yoga block",
			strength, hip, lord, p3, variable, bw, "7-8", 3, 10},
		{"Hip Thrust – Single Leg on BOSU",
			"Supine, one foot on BOSU dome, single-leg hip thrust.",
			"Unilateral glute strength with proprioceptive challenge", "BOSU",
			strength, hip, lord, p3, variable, bw, "7-8", 3, 10},
		{"Hip Thrust – Single Leg on Physio Ball",
			"Supine, one foot on physio ball, single-leg hip thrust.",
			"Glute strength with high instability demand", "Physio ball",
			strength, hip, lord, p3, variable, bw, "8-9", 3, 8},
		{"Hip Thrust – Both Legs on BOSU",
			"Supine, both feet on BOSU, drive hips up.",
			"Glute strength with proprioceptive challenge", "BOSU",
			strength, hip, lord, p3, variable, bw, "7-8", 3, 12},
		{"Hip Thrust – Feet Together",
			"Supine, heels together, drive hips to full extension for adductor co-activation.",
			"Glute and adductor co-activation", "Mat",
			strength, hip, lord, p2, variable, bw, "6-7", 3, 12},
		// Single-leg balance
		{"Single-Leg Balance – Calf Raises",
			"Standing on one leg, perform slow calf raises.",
			"Proprioception, calf strength and balance", "",
			functional, ankle, pron, p2, variable, bw, "6-7", 3, 12},
		// Core stability
		{"Side Plank with Ball Squeeze",
			"Side plank with ball between knees. Squeeze ball as you lift hips. Lower knee remains on floor.",
			"Lateral core stability with adductor activation", "Ball",
			rehab, core, lord, p2, fixed, bw, "6-7", 3, 30},
		{"All-Fours Crossed Extension",
			"Quadruped, bent leg lifts toward ceiling while opposite arm pulls band to body side.",
			"Multifidus and contralateral glute activation", "Optional band",
			rehab, core, lord, p1, variable, bandLight, "5-6", 3, 10},
		{"Push-Up",
			"Standard push-up, body in straight plank line throughout.",
			"Chest, triceps and serratus anterior strength", "",
			strength, shoulder, kyph, p2, fixed, bw, "7-8", 3, 12},
		{"Push-Up on Knees",
			"Modified push-up with knees on floor.",
			"Chest and serratus activation with reduced load", "",
			rehab, shoulder, kyph, p1, variable, bw, "5-6", 3, 12},
		// Thoracic / Shoulder Mobility
		{"Thoracic Extension on Foam Roller",
			"Roller below shoulder blades; extend thoracic spine over roller.",
			"Thoracic extension mobility, kyphosis correction", "Foam roller",
			mob, shoulder, kyph, p1, fixed, bw, "5-6", 2, 10},
		{"Chest Opening on Swiss Ball",
			"Supine on Swiss ball, hold dumbbells, let chest open.",
			"Pec stretch and thoracic extension", "Swiss ball, dumbbells",
			mob, shoulder, kyph, p1, fixed, bw, "5-6", 2, 30},
		{"Trunk Rotation Next to Wall",
			"Standing side to wall, rotate thoracic spine with hands at chest height.",
			"Thoracic rotation mobility", "Wall",
			mob, shoulder, kyph, p1, variable, bw, "5-6", 2, 10},
		{"Shoulder Internal Rotation – Side Lying",
			"Side-lying, arm at 90° abduction; resist plate/dumbbell into internal rotation.",
			"Subscapularis and internal rotator strength", "Plate or dumbbell",
			rehab, shoulder, kyph, p2, variable, bandLight, "6-7", 3, 12},
		{"Shoulder Flexion with Stick on Foam Roller",
			"Lying on foam roller, hold stick; perform shoulder flexion and extension.",
			"Shoulder ROM and overhead mobility", "Stick, foam roller",
			mob, shoulder, kyph, p1, fixed, bw, "5-6", 2, 10},
		{"Shoulder Retraction with Band",
			"Band anchored at shoulder height; pull elbows back squeezing scapulae.",
			"Scapular retraction and rhomboid activation", "Band",
			rehab, shoulder, kyph, p1, fixed, bandLight, "5-6", 3, 12},
		{"Angels on Foam Roller",
			"Lying on foam roller, arms slide along floor from sides to overhead and back.",
			"Shoulder mobility and serratus activation", "Foam roller",
			mob, shoulder, kyph, p1, fixed, bw, "5-6", 2, 10},
		{"Stick Behind Back – ROM",
			"Hold stick behind back, one hand at ear and one under shoulder blade; glide up and down.",
			"Shoulder internal and external rotation ROM", "Stick",
			mob, shoulder, kyph, p1, variable, bw, "5-6", 2, 10},
		{"Hip Internal Rotation – Banded",
			"Yoga block between feet, band between ankles; perform hip internal rotation.",
			"Hip internal rotator strengthening", "Yoga block, band",
			rehab, hip, lord, p1, variable, bandLight, "5-6", 3, 12},
		{"Book Opening – Side Lying",
			"Side-lying with band under knee; rotate top arm toward ceiling like opening a book.",
			"Thoracic rotation mobility", "Optional band",
			mob, shoulder, kyph, p1, variable, bw, "5-6", 2, 10},
		{"90/90 Hip Rotations",
			"Seated with both legs in 90/90 position; rotate side to side.",
			"Hip internal and external rotation ROM", "",
			mob, hip, lord, p1, variable, bw, "5-6", 2, 10},
		{"Hip Internal Stretch 90/90",
			"Seated in 90/90; lean forward over front leg for internal rotation stretch.",
			"Hip internal rotator flexibility", "",
			mob, hip, lord, p1, fixed, bw, "5-6", 2, 30},
		{"Shoulder Abduction with Dumbbell",
			"Standing, raise arm to 90° abduction with dumbbell.",
			"Deltoid and supraspinatus strengthening", "Dumbbell",
			strength, shoulder, kyph, p2, variable, bandLight, "6-7", 3, 12},
		{"Shoulder Flexion with Dumbbell",
			"Standing, raise arm forward to 90° with dumbbell.",
			"Anterior deltoid and serratus strengthening", "Dumbbell",
			strength, shoulder, kyph, p2, variable, bandLight, "6-7", 3, 12},
		{"Retraction/Protraction in Push-Up Position",
			"In plank position, alternate scapular retraction and protraction.",
			"Serratus anterior and scapular stabiliser activation", "",
			rehab, shoulder, kyph, p1, fixed, bw, "5-6", 3, 12},
		{"Calf Stretch / Down Dog",
			"Simple calf stretch against wall or downward dog with heels toward floor.",
			"Calf and Achilles flexibility", "Wall (optional)",
			mob, ankle, pron, p1, fixed, bw, "5-6", 2, 30},
		// SIJ
		{"One Arm Banded Internal Rotation",
			"Band at elbow height; 90° elbow at side and scapula back, pull into internal rotation.",
			"Shoulder internal rotator with scapular stability", "Band",
			rehab, shoulder, kyph, p2, fixed, bandLight, "6-7", 3, 12},
		{"One Arm Banded External Rotation",
			"Band at elbow height; 90° elbow at side and scapula back, pull into external rotation.",
			"Shoulder external rotator with scapular stability", "Band",
			rehab, shoulder, kyph, p2, fixed, bandLight, "6-7", 3, 12},
		{"One Arm Banded Push",
			"Band at elbow level; push from 90° to full elbow extension.",
			"Chest and triceps activation against resistance", "Band",
			strength, shoulder, kyph, p2, variable, bandMed, "6-7", 3, 12},
		{"One Arm Banded Pull",
			"Band anchored; pull from straight arm to fully bent elbow close to body.",
			"Lat and bicep pull-through", "Band",
			strength, shoulder, kyph, p2, variable, bandMed, "6-7", 3, 12},
		// Mobility General
		{"Banded Shoulder Circles",
			"Band held with straight arms; full circles forward and backward.",
			"Shoulder girdle warm-up and mobility", "Band",
			mob, general, gen, p1, fixed, bw, "5-6", 2, 10},
		{"Full Body Circles",
			"Standing, arms overhead; full body rotation in circles.",
			"Global mobility warm-up", "",
			mob, general, gen, p1, fixed, bw, "5-6", 2, 10},
		{"Down Dog / Up Dog Flow",
			"Alternating downward and upward dog positions.",
			"Spine extension/flexion, hamstring and hip flexor mobility", "Mat",
			mob, general, gen, p1, fixed, bw, "5-6", 2, 10},
		{"Sumo Squat to Straddle Stretch",
			"Wide stance squat; shift from squat to straddle stretch.",
			"Adductor and hip mobility", "",
			mob, hip, lord, p1, variable, bw, "5-6", 2, 10},
		{"Runner's Lunge with Trunk Rotation",
			"Deep lunge; rotate trunk over front leg.",
			"Hip flexor, thoracic and total lower-body mobility", "",
			mob, hip, lord, p1, variable, bw, "5-6", 2, 10},
		{"Single-Leg Middle Split Stretch",
			"Standing, one leg to side; sink into split position.",
			"Adductor flexibility and single-leg control", "",
			mob, hip, lord, p1, variable, bw, "5-6", 2, 30},
		{"Deep Lunge with Opposite Arm Grab",
			"Deep lunge; reach opposite arm to grab back foot.",
			"Hip flexor stretch with quad and shoulder opening", "",
			mob, hip, lord, p1, variable, bw, "5-6", 2, 30},
	}

	result := make([]*physio.PhysioExercise, len(defs))
	for i, d := range defs {
		result[i] = &physio.PhysioExercise{
			ExerciseId:       genID("cex", i),
			Name:             d.name,
			Description:      d.description,
			ExerciseAim:      d.aim,
			Equipment:        d.equipment,
			Category:         d.category,
			Joint:            d.joint,
			Posture:          d.posture,
			Phase:            d.phase,
			ExerciseType:     d.exType,
			LoadType:         d.loadType,
			Effort:           d.effort,
			DefaultSets:      d.sets,
			DefaultReps:      d.reps,
			VideoStoragePath: pickVideoURL(i),
			IsActive:         true,
			AuditInfo:        createAuditInfo(),
		}
	}
	return result
}

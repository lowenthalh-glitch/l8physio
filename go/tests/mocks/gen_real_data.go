package mocks

import (
	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// generateRehabBankExercises returns the 62 classified exercises from the client's
// rehab_protocol_builder_with_prescription_v2.xlsx Exercise Bank sheet.
// These exercises have full classification: joint, posture, category, phase, type, load.
func generateRehabBankExercises() []*physio.PhysioExercise {
	type rbDef struct {
		name, effort, repsDisplay, loadNotes string
		cat                                  physio.PhysioExerciseCategory
		joint                                physio.PhysioJoint
		posture                              physio.PhysioPosture
		phase                                physio.PhysioPhase
		exType                               physio.PhysioExerciseType
		loadType                             physio.PhysioLoadType
	}

	// Short aliases
	mob := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY
	rehab := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_REHAB
	str := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH
	fun := physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FUNCTIONAL

	sho := physio.PhysioJoint_PHYSIO_JOINT_SHOULDER
	kne := physio.PhysioJoint_PHYSIO_JOINT_KNEE
	gen := physio.PhysioJoint_PHYSIO_JOINT_GENERAL

	kyph := physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS
	lord := physio.PhysioPosture_PHYSIO_POSTURE_LORDOSIS
	valg := physio.PhysioPosture_PHYSIO_POSTURE_VALGUS
	pron := physio.PhysioPosture_PHYSIO_POSTURE_PRONATION

	p1 := physio.PhysioPhase_PHYSIO_PHASE_1
	p2 := physio.PhysioPhase_PHYSIO_PHASE_2
	p3 := physio.PhysioPhase_PHYSIO_PHASE_3

	fixed := physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_FIXED
	variable := physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_VARIABLE

	ctrl := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_CONTROL
	bw := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BODYWEIGHT
	bandL := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_LIGHT
	bandM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_MEDIUM
	dbM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL_MED
	dbH := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL_HEAVY

	// name, effort, repsDisplay, loadNotes, category, joint, posture, phase, type, loadType
	defs := []rbDef{
		// Shoulder / Kyphosis
		{"Thoracic extension foam roller", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, p1, fixed, ctrl},
		{"Pec stretch wall", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, p1, fixed, ctrl},
		{"Open book rotation", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, p2, variable, ctrl},
		{"Wall slides", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, p2, variable, ctrl},
		{"Band shoulder dislocate", "6-7", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, p3, variable, ctrl},
		{"Scapular setting", "5-6", "10-12", "כאב ≤ 3/10", rehab, sho, kyph, p1, fixed, bandL},
		{"Serratus punches", "5-6", "10-12", "כאב ≤ 3/10", rehab, sho, kyph, p1, fixed, bandL},
		{"Wall slides with lift off", "6-7", "10-12", "שליטה מלאה", rehab, sho, kyph, p2, variable, bandM},
		{"Y raise prone", "6-7", "10-12", "שליטה מלאה", rehab, sho, kyph, p2, variable, bandM},
		{"Lower trap raises", "6-7", "8-10", "דיוק לפני עומס", rehab, sho, kyph, p3, variable, bandM},
		{"Seated row band", "5-6", "10-12", "עומס קל", str, sho, kyph, p1, fixed, bw},
		{"Face pull", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, p2, fixed, dbM},
		{"Dumbbell row", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, p2, variable, dbM},
		{"External rotation band", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, p2, variable, dbM},
		{"Cable row heavy", "7-8", "6-10", "ללא פיצוי", str, sho, kyph, p3, variable, dbH},
		{"Band pull + hold", "5-6", "20-30 sec / 8-10", "יציבות בסיסית", fun, sho, kyph, p1, variable, bw},
		{"Row to press", "6-7", "8-12", "שליטה דינמית", fun, sho, kyph, p2, variable, bandM},
		{"Overhead control carry", "6-7", "8-12", "שליטה דינמית", fun, sho, kyph, p2, variable, bandM},
		{"Push pull dynamic", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, sho, kyph, p3, variable, dbM},
		{"Med ball throw light", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, sho, kyph, p3, variable, dbM},
		// Knee / Valgus
		{"Adductor stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, p1, fixed, ctrl},
		{"Ankle dorsiflexion stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, p1, fixed, ctrl},
		{"Hip opener stretch", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, p2, variable, ctrl},
		{"Dynamic lunge stretch", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, p2, variable, ctrl},
		{"Deep squat hold", "6-7", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, p3, variable, ctrl},
		{"Clam shell", "5-6", "10-12", "כאב ≤ 3/10", rehab, kne, valg, p1, fixed, bandL},
		{"Side walk band", "5-6", "10-12", "כאב ≤ 3/10", rehab, kne, valg, p1, fixed, bandL},
		{"Single leg balance", "6-7", "10-12", "שליטה מלאה", rehab, kne, valg, p2, variable, bandM},
		{"Step down control", "6-7", "10-12", "שליטה מלאה", rehab, kne, valg, p2, variable, bandM},
		{"Single leg reach", "6-7", "8-10", "דיוק לפני עומס", rehab, kne, valg, p3, variable, bandM},
		{"Hip thrust", "5-6", "10-12", "עומס קל", str, kne, valg, p1, fixed, bw},
		{"Static squat", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, p2, fixed, dbM},
		{"Split squat", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, p2, variable, dbM},
		{"Step up", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, p2, variable, dbM},
		{"Single leg squat", "7-8", "6-10", "ללא פיצוי", str, kne, valg, p3, variable, dbH},
		{"Balance hold", "5-6", "20-30 sec / 8-10", "יציבות בסיסית", fun, kne, valg, p1, variable, bw},
		{"Step pattern", "6-7", "8-12", "שליטה דינמית", fun, kne, valg, p2, variable, bandM},
		{"Lateral movement", "6-7", "8-12", "שליטה דינמית", fun, kne, valg, p2, variable, bandM},
		{"Jump landing drill", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, kne, valg, p3, variable, dbM},
		{"Reactive hop", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, kne, valg, p3, variable, dbM},
		// General / Kyphosis
		{"Thoracic breathing opener", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, p1, fixed, ctrl},
		{"Wall chest opener", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, p1, fixed, ctrl},
		{"Open book flow", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, p2, variable, ctrl},
		{"Band pull apart", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, kyph, p1, fixed, bandL},
		{"Serratus wall reach", "6-7", "10-12", "שליטה מלאה", rehab, gen, kyph, p2, variable, bandM},
		{"Supported row", "5-6", "10-12", "עומס קל", str, gen, kyph, p1, fixed, bw},
		{"Face pull light", "6-7", "8-12", "מאתגר אך נקי", str, gen, kyph, p2, variable, dbM},
		{"Carry with posture control", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, kyph, p3, variable, dbM},
		// General / Lordosis
		{"90/90 pelvic reset", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, lord, p1, fixed, ctrl},
		{"Hip flexor stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, lord, p1, fixed, ctrl},
		{"Posterior pelvic tilt drill", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, lord, p1, fixed, bandL},
		{"Dead bug basic", "6-7", "10-12", "שליטה מלאה", rehab, gen, lord, p2, variable, bandM},
		{"Glute bridge", "5-6", "10-12", "עומס קל", str, gen, lord, p1, fixed, bw},
		{"Hamstring curl ball", "6-7", "8-12", "מאתגר אך נקי", str, gen, lord, p2, variable, dbM},
		{"Farmer carry controlled", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, lord, p3, variable, dbM},
		// General / Pronation
		{"Foot tripod drill", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, pron, p1, fixed, ctrl},
		{"Calf stretch wall", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, pron, p1, fixed, ctrl},
		{"Arch control hold", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, pron, p1, fixed, bandL},
		{"Single leg balance arch", "6-7", "10-12", "שליטה מלאה", rehab, gen, pron, p2, variable, bandM},
		{"Calf raise controlled", "5-6", "10-12", "עומס קל", str, gen, pron, p1, fixed, bw},
		{"Tibialis raise wall", "6-7", "8-12", "מאתגר אך נקי", str, gen, pron, p2, variable, dbM},
		{"Reactive balance tap", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, pron, p3, variable, dbM},
	}

	result := make([]*physio.PhysioExercise, len(defs))
	for i, d := range defs {
		result[i] = &physio.PhysioExercise{
			ExerciseId:         lm.GenID("rbex", i),
			Name:               d.name,
			Category:           d.cat,
			Joint:              d.joint,
			Posture:            d.posture,
			Phase:              d.phase,
			ExerciseType:       d.exType,
			LoadType:           d.loadType,
			Effort:             d.effort,
			DefaultRepsDisplay: d.repsDisplay,
			LoadNotes:          d.loadNotes,
			IsActive:           true,
			AuditInfo:          lm.CreateAuditInfo(),
		}
	}
	return result
}

// pe builds a ProtocolExercise entry with a direct cex-index reference.
func pe(orderIndex, cexIndex int, name string, sets int32, reps, effort string, loadType physio.PhysioLoadType) *physio.ProtocolExercise {
	return &physio.ProtocolExercise{
		ProtocolExerciseId: lm.GenID("pe", orderIndex*100+cexIndex),
		ExerciseId:         lm.GenID("cex", cexIndex),
		ExerciseName:       name,
		OrderIndex:         int32(orderIndex),
		Sets:               sets,
		Reps:               reps,
		Effort:             effort,
		LoadType:           loadType,
	}
}

// generateClientProtocols returns the 9 protocol templates from protocols.xlsx,
// with exercise IDs mapped directly to the cex-xxx IDs from generateClientExercises.
func generateClientProtocols() []*physio.PhysioProtocol {
	bw := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BODYWEIGHT
	bandL := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_LIGHT
	bandM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_MEDIUM

	return []*physio.PhysioProtocol{
		// ── 1. KNEE ──────────────────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 0),
			Name:         "Knee",
			ProtocolCode: "KNE",
			Description:  "Comprehensive knee rehabilitation protocol targeting VMO, glutes, and dynamic stability.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_KNEE,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_VALGUS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 20, "Knee Extension – Seated on Box", 3, "12", "6-7", bw),
				pe(2, 15, "Hamstring Curls with Band", 3, "12", "6-7", bandL),
				pe(3, 17, "Clam Shell", 3, "15", "5-6", bandL),
				pe(4, 18, "Side Walk with Band", 3, "15", "6-7", bandM),
				pe(5, 16, "Hip Thrust with Ball Squeeze", 3, "12", "7-8", bw),
				pe(6, 12, "Wall Squat – Medial Head", 3, "45s", "5-6", bw),
				pe(7, 8, "Calf Raises", 3, "15", "6-7", bw),
				pe(8, 19, "Knee Flexion–Extension Slides", 3, "15", "5-6", bw),
			},
		},
		// ── 2. SHOULDER AND THORACIC ─────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 1),
			Name:         "Shoulder and Thoracic",
			ProtocolCode: "KYPH-SHO",
			Description:  "Protocol addressing kyphotic posture: thoracic mobility, scapular stability, and shoulder strength.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_SHOULDER,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 34, "Thoracic Extension on Foam Roller", 2, "10", "5-6", bw),
				pe(2, 35, "Chest Opening on Swiss Ball", 2, "30s", "5-6", bw),
				pe(3, 36, "Trunk Rotation Next to Wall", 2, "10", "5-6", bw),
				pe(4, 37, "Shoulder Internal Rotation – Side Lying", 3, "12", "6-7", bandL),
				pe(5, 38, "Shoulder Flexion with Stick on Foam Roller", 2, "10", "5-6", bw),
				pe(6, 39, "Shoulder Retraction with Band", 3, "12", "5-6", bandL),
				pe(7, 6, "TRX Row – Narrow Grip", 3, "10", "7-8", bw),
				pe(8, 7, "TRX Row – Wide Grip", 3, "10", "7-8", bw),
				pe(9, 54, "Banded Shoulder Circles", 2, "10", "5-6", bw),
				pe(10, 3, "Scapular Setting – V", 3, "12", "5-6", bw),
				pe(11, 4, "Scapular Setting – T", 3, "12", "5-6", bw),
				pe(12, 5, "Scapular Setting – Y", 3, "10", "6-7", bw),
				pe(13, 40, "Angels on Foam Roller", 2, "10", "5-6", bw),
				pe(14, 41, "Stick Behind Back – ROM", 2, "10", "5-6", bw),
				pe(15, 51, "One Arm Banded External Rotation", 3, "12", "6-7", bandL),
			},
		},
		// ── 3. MOBILITY GENERAL ─────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 2),
			Name:         "Mobility General",
			ProtocolCode: "MOB-GEN",
			Description:  "Full-body warm-up and mobility routine covering all major joints and movement planes.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_GENERAL,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_GENERAL,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 54, "Banded Shoulder Circles", 2, "10", "5-6", bw),
				pe(2, 55, "Full Body Circles", 2, "10", "5-6", bw),
				pe(3, 56, "Down Dog / Up Dog Flow", 2, "10", "5-6", bw),
				pe(4, 57, "Sumo Squat to Straddle Stretch", 2, "10", "5-6", bw),
				pe(5, 58, "Runner's Lunge with Trunk Rotation", 2, "10", "5-6", bw),
				pe(6, 59, "Single-Leg Middle Split Stretch", 2, "30s", "5-6", bw),
				pe(7, 60, "Deep Lunge with Opposite Arm Grab", 2, "30s", "5-6", bw),
			},
		},
		// ── 4. SIJ ──────────────────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 3),
			Name:         "SIJ",
			ProtocolCode: "SIJ",
			Description:  "Sacroiliac joint stabilisation protocol: lateral hip, core, and lumbar stability.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_LOWER_BACK,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_GENERAL,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 18, "Side Walk with Band", 3, "15", "6-7", bandM),
				pe(2, 49, "Calf Stretch / Down Dog", 2, "30s", "5-6", bw),
				pe(3, 30, "Side Plank with Ball Squeeze", 3, "30s", "6-7", bw),
				pe(4, 31, "All-Fours Crossed Extension", 3, "10", "5-6", bandL),
			},
		},
		// ── 5. SHOULDER ROCK WOOD ────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 4),
			Name:         "Shoulder Rock Wood",
			ProtocolCode: "SHO-RW",
			Description:  "Rotator cuff and shoulder girdle strengthening using banded resistance in all planes.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_SHOULDER,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 50, "One Arm Banded Internal Rotation", 3, "12", "6-7", bandL),
				pe(2, 51, "One Arm Banded External Rotation", 3, "12", "6-7", bandL),
				pe(3, 52, "One Arm Banded Push", 3, "12", "6-7", bandM),
				pe(4, 53, "One Arm Banded Pull", 3, "12", "6-7", bandM),
			},
		},
		// ── 6. HIP AND LOWER BACK ────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 5),
			Name:         "Hip and Lower Back",
			ProtocolCode: "HIP-LBP",
			Description:  "Comprehensive hip and lumbar protocol: mobility, core control, and glute strengthening.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_HIP,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_LORDOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 59, "Single-Leg Middle Split Stretch", 2, "30s", "5-6", bw),
				pe(2, 44, "90/90 Hip Rotations", 2, "10", "5-6", bw),
				pe(3, 45, "Hip Internal Stretch 90/90", 2, "30s", "5-6", bw),
				pe(4, 0, "PPT with Ball Squeeze", 3, "15", "5-6", bw),
				pe(5, 1, "PPT Crunches with Ball Squeeze", 3, "12", "5-6", bw),
				pe(6, 2, "PPT Shoulder Flexion with Ball Squeeze", 3, "10", "5-6", bandL),
				pe(7, 18, "Side Walk with Band", 3, "15", "6-7", bandM),
				pe(8, 30, "Side Plank with Ball Squeeze", 3, "30s", "6-7", bw),
				pe(9, 17, "Clam Shell", 3, "15", "5-6", bandL),
				pe(10, 42, "Hip Internal Rotation – Banded", 3, "12", "5-6", bandL),
				pe(11, 22, "Hip Thrust – Both Legs on Box", 3, "12", "7-8", bw),
				pe(12, 28, "Hip Thrust – Feet Together", 3, "12", "6-7", bw),
				pe(13, 16, "Hip Thrust with Ball Squeeze", 3, "12", "7-8", bw),
				pe(14, 15, "Hamstring Curls with Band", 3, "12", "6-7", bandL),
			},
		},
		// ── 7. BALANCE ──────────────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 6),
			Name:         "Balance",
			ProtocolCode: "BAL",
			Description:  "Progressive balance and proprioception protocol from foot activation to dynamic single-leg tasks.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_ANKLE,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_PRONATION,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 11, "Toe Taps", 3, "15", "5-6", bw),
				pe(2, 8, "Calf Raises", 3, "15", "6-7", bw),
				pe(3, 29, "Single-Leg Balance – Calf Raises", 3, "12", "6-7", bw),
			},
		},
		// ── 8. CORE ─────────────────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 7),
			Name:         "Core",
			ProtocolCode: "CORE",
			Description:  "Core stability series progressing from posterior pelvic tilt activation to dynamic loading.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_CORE,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_LORDOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 0, "PPT with Ball Squeeze", 3, "15", "5-6", bw),
				pe(2, 1, "PPT Crunches with Ball Squeeze", 3, "12", "5-6", bw),
				pe(3, 2, "PPT Shoulder Flexion with Ball Squeeze", 3, "10", "5-6", bandL),
				pe(4, 30, "Side Plank with Ball Squeeze", 3, "30s", "6-7", bw),
				pe(5, 31, "All-Fours Crossed Extension", 3, "10", "5-6", bandL),
			},
		},
		// ── 9. BACK ─────────────────────────────────────────────────────────────
		{
			ProtocolId:   lm.GenID("prt", 8),
			Name:         "Back",
			ProtocolCode: "BACK",
			Description:  "Posterior chain activation targeting erector spinae and scapular retractors.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_LOWER_BACK,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    lm.CreateAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				pe(1, 31, "All-Fours Crossed Extension", 3, "10", "5-6", bandL),
				pe(2, 3, "Scapular Setting – V", 3, "12", "5-6", bw),
				pe(3, 4, "Scapular Setting – T", 3, "12", "5-6", bw),
				pe(4, 5, "Scapular Setting – Y", 3, "10", "6-7", bw),
				pe(5, 39, "Shoulder Retraction with Band", 3, "12", "5-6", bandL),
			},
		},
	}
}

package mocks

import (
	lm "github.com/saichler/l8common/go/mocks"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
)

// generateRehabBankExercises returns the 62 classified exercises from the client's
// rehab_protocol_builder_with_prescription_v2.xlsx Exercise Bank sheet.
// These exercises have full classification: joint, posture, category, load.
func generateRehabBankExercises() []*physio.PhysioExercise {
	type rbDef struct {
		name, effort, repsDisplay, loadNotes string
		cat                                  physio.PhysioExerciseCategory
		joint                                physio.PhysioJoint
		posture                              physio.PhysioPosture
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

	ctrl := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_CONTROL
	bw := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BODYWEIGHT
	bandL := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_LIGHT
	bandM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_MEDIUM
	dbM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL
	dbH := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL

	// name, effort, repsDisplay, loadNotes, category, joint, posture, loadType
	defs := []rbDef{
		// Shoulder / Kyphosis
		{"Thoracic extension foam roller", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, ctrl},
		{"Pec stretch wall", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, ctrl},
		{"Open book rotation", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, ctrl},
		{"Wall slides", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, ctrl},
		{"Band shoulder dislocate", "6-7", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, sho, kyph, ctrl},
		{"Scapular setting", "5-6", "10-12", "כאב ≤ 3/10", rehab, sho, kyph, bandL},
		{"Serratus punches", "5-6", "10-12", "כאב ≤ 3/10", rehab, sho, kyph, bandL},
		{"Wall slides with lift off", "6-7", "10-12", "שליטה מלאה", rehab, sho, kyph, bandM},
		{"Y raise prone", "6-7", "10-12", "שליטה מלאה", rehab, sho, kyph, bandM},
		{"Lower trap raises", "6-7", "8-10", "דיוק לפני עומס", rehab, sho, kyph, bandM},
		{"Seated row band", "5-6", "10-12", "עומס קל", str, sho, kyph, bw},
		{"Face pull", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, dbM},
		{"Dumbbell row", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, dbM},
		{"External rotation band", "6-7", "8-12", "מאתגר אך נקי", str, sho, kyph, dbM},
		{"Cable row heavy", "7-8", "6-10", "ללא פיצוי", str, sho, kyph, dbH},
		{"Band pull + hold", "5-6", "20-30 sec / 8-10", "יציבות בסיסית", fun, sho, kyph, bw},
		{"Row to press", "6-7", "8-12", "שליטה דינמית", fun, sho, kyph, bandM},
		{"Overhead control carry", "6-7", "8-12", "שליטה דינמית", fun, sho, kyph, bandM},
		{"Push pull dynamic", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, sho, kyph, dbM},
		{"Med ball throw light", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, sho, kyph, dbM},
		// Knee / Valgus
		{"Adductor stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, ctrl},
		{"Ankle dorsiflexion stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, ctrl},
		{"Hip opener stretch", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, ctrl},
		{"Dynamic lunge stretch", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, ctrl},
		{"Deep squat hold", "6-7", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, kne, valg, ctrl},
		{"Clam shell", "5-6", "10-12", "כאב ≤ 3/10", rehab, kne, valg, bandL},
		{"Side walk band", "5-6", "10-12", "כאב ≤ 3/10", rehab, kne, valg, bandL},
		{"Single leg balance", "6-7", "10-12", "שליטה מלאה", rehab, kne, valg, bandM},
		{"Step down control", "6-7", "10-12", "שליטה מלאה", rehab, kne, valg, bandM},
		{"Single leg reach", "6-7", "8-10", "דיוק לפני עומס", rehab, kne, valg, bandM},
		{"Hip thrust", "5-6", "10-12", "עומס קל", str, kne, valg, bw},
		{"Static squat", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, dbM},
		{"Split squat", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, dbM},
		{"Step up", "6-7", "8-12", "מאתגר אך נקי", str, kne, valg, dbM},
		{"Single leg squat", "7-8", "6-10", "ללא פיצוי", str, kne, valg, dbH},
		{"Balance hold", "5-6", "20-30 sec / 8-10", "יציבות בסיסית", fun, kne, valg, bw},
		{"Step pattern", "6-7", "8-12", "שליטה דינמית", fun, kne, valg, bandM},
		{"Lateral movement", "6-7", "8-12", "שליטה דינמית", fun, kne, valg, bandM},
		{"Jump landing drill", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, kne, valg, dbM},
		{"Reactive hop", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, kne, valg, dbM},
		// General / Kyphosis
		{"Thoracic breathing opener", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, ctrl},
		{"Wall chest opener", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, ctrl},
		{"Open book flow", "5-6", "10-12 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, kyph, ctrl},
		{"Band pull apart", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, kyph, bandL},
		{"Serratus wall reach", "6-7", "10-12", "שליטה מלאה", rehab, gen, kyph, bandM},
		{"Supported row", "5-6", "10-12", "עומס קל", str, gen, kyph, bw},
		{"Face pull light", "6-7", "8-12", "מאתגר אך נקי", str, gen, kyph, dbM},
		{"Carry with posture control", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, kyph, dbM},
		// General / Lordosis
		{"90/90 pelvic reset", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, lord, ctrl},
		{"Hip flexor stretch", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, lord, ctrl},
		{"Posterior pelvic tilt drill", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, lord, bandL},
		{"Dead bug basic", "6-7", "10-12", "שליטה מלאה", rehab, gen, lord, bandM},
		{"Glute bridge", "5-6", "10-12", "עומס קל", str, gen, lord, bw},
		{"Hamstring curl ball", "6-7", "8-12", "מאתגר אך נקי", str, gen, lord, dbM},
		{"Farmer carry controlled", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, lord, dbM},
		// General / Pronation
		{"Foot tripod drill", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, pron, ctrl},
		{"Calf stretch wall", "5-6", "8-10 / 20-30 sec", "איכות תנועה לפני עומס", mob, gen, pron, ctrl},
		{"Arch control hold", "5-6", "10-12", "כאב ≤ 3/10", rehab, gen, pron, bandL},
		{"Single leg balance arch", "6-7", "10-12", "שליטה מלאה", rehab, gen, pron, bandM},
		{"Calf raise controlled", "5-6", "10-12", "עומס קל", str, gen, pron, bw},
		{"Tibialis raise wall", "6-7", "8-12", "מאתגר אך נקי", str, gen, pron, dbM},
		{"Reactive balance tap", "7-8", "6-10 / 20 sec", "פונקציונלי / תגובתי", fun, gen, pron, dbM},
	}

	rotGroups := map[int]string{
		2: "shoulder-mob-p2", 3: "shoulder-mob-p2",
		25: "knee-rehab-p1", 26: "knee-rehab-p1",
		27: "knee-rehab-p2", 28: "knee-rehab-p2",
		31: "knee-str-p2", 32: "knee-str-p2", 33: "knee-str-p2",
	}

	result := make([]*physio.PhysioExercise, len(defs))
	for i, d := range defs {
		result[i] = &physio.PhysioExercise{
			ExerciseId:         lm.GenID("rbex", i),
			Name:               d.name,
			Category:           d.cat,
			Joint:              d.joint,
			Posture:            d.posture,
			Postures:           []physio.PhysioPosture{d.posture},
			LoadType:           d.loadType,
			Effort:             d.effort,
			DefaultRepsDisplay: d.repsDisplay,
			LoadNotes:          d.loadNotes,
			RotationGroupId:    rotGroups[i],
			ImageStoragePath:   LookupImagePath(d.name),
			IsActive:           true,
			AuditInfo:          lm.CreateAuditInfo(),
		}
	}
	return result
}


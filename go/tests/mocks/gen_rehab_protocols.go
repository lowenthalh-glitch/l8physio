package mocks

import (
	"github.com/saichler/l8physio/go/types/physio"
)

// per builds a ProtocolExercise entry referencing a rehab-bank exercise (rbex-xxx ID).
func per(orderIndex, rbexIndex int, name string, sets int32, reps, effort string, loadType physio.PhysioLoadType) *physio.ProtocolExercise {
	return &physio.ProtocolExercise{
		ProtocolExerciseId: genID("per", orderIndex*100+rbexIndex),
		ExerciseId:         genID("rbex", rbexIndex),
		ExerciseName:       name,
		OrderIndex:         int32(orderIndex),
		Sets:               sets,
		Reps:               reps,
		Effort:             effort,
		LoadType:           loadType,
	}
}

// generateRehabProtocols returns 5 protocol templates built from the classified exercises
// in the rehab_protocol_builder_with_prescription_v2.xlsx Exercise Bank.
// Each protocol covers all phases and categories for a given joint/posture combination.
// Protocol IDs continue from prt-9 (prt-0 through prt-8 are used by generateClientProtocols).
func generateRehabProtocols() []*physio.PhysioProtocol {
	ctrl := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_CONTROL
	bw := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BODYWEIGHT
	bandL := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_LIGHT
	bandM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_BAND_MEDIUM
	dbM := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL_MED
	dbH := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL_HEAVY
	_ = dbH

	return []*physio.PhysioProtocol{

		// ── 1. KYPH-SHO: Shoulder / Kyphosis ────────────────────────────────────
		{
			ProtocolId:   genID("prt", 9),
			Name:         "Shoulder Posture – KYPH-SHO",
			ProtocolCode: "KYPH-SHO",
			Description:  "Systematic shoulder and thoracic protocol for kyphosis. All phases: mobility, rehab, strength, functional.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_SHOULDER,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    createAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				// Mobility – Phase 1 (Fixed)
				per(1, 0, "Thoracic Extension Foam Roller", 3, "10", "5-6", ctrl),
				per(2, 1, "Pec Stretch Wall", 3, "10", "5-6", ctrl),
				// Mobility – Phase 2 (Variable)
				per(3, 2, "Open Book Rotation", 3, "12", "5-6", ctrl),
				per(4, 3, "Wall Slides", 3, "12", "5-6", ctrl),
				// Mobility – Phase 3 (Variable)
				per(5, 4, "Band Shoulder Dislocate", 3, "12", "6-7", ctrl),
				// Rehab – Phase 1 (Fixed)
				per(6, 5, "Scapular Setting", 3, "12", "5-6", bandL),
				per(7, 6, "Serratus Punches", 3, "12", "5-6", bandL),
				// Rehab – Phase 2 (Variable)
				per(8, 7, "Wall Slides with Lift Off", 3, "12", "6-7", bandM),
				per(9, 8, "Y Raise Prone", 3, "12", "6-7", bandM),
				// Rehab – Phase 3 (Variable)
				per(10, 9, "Lower Trap Raises", 3, "10", "6-7", bandM),
				// Strength – Phase 1 (Fixed)
				per(11, 10, "Seated Row Band", 3, "12", "5-6", bw),
				// Strength – Phase 2
				per(12, 11, "Face Pull", 3, "12", "6-7", dbM),
				per(13, 12, "Dumbbell Row", 3, "12", "6-7", dbM),
				per(14, 13, "External Rotation Band", 3, "12", "6-7", dbM),
				// Strength – Phase 3
				per(15, 14, "Cable Row Heavy", 4, "8", "7-8", dbH),
				// Functional – Phase 1
				per(16, 15, "Band Pull + Hold", 3, "20s", "5-6", bw),
				// Functional – Phase 2
				per(17, 16, "Row to Press", 3, "12", "6-7", bandM),
				per(18, 17, "Overhead Control Carry", 3, "12", "6-7", bandM),
				// Functional – Phase 3
				per(19, 18, "Push Pull Dynamic", 4, "8", "7-8", dbM),
				per(20, 19, "Med Ball Throw Light", 4, "8", "7-8", dbM),
			},
		},

		// ── 2. VALG-KNE: Knee / Valgus ──────────────────────────────────────────
		{
			ProtocolId:   genID("prt", 10),
			Name:         "Knee Posture – VALG-KNE",
			ProtocolCode: "VALG-KNE",
			Description:  "Systematic knee valgus protocol. All phases: mobility, rehab, strength, functional.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_KNEE,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_VALGUS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    createAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				// Mobility – Phase 1 (Fixed)
				per(1, 20, "Adductor Stretch", 3, "10", "5-6", ctrl),
				per(2, 21, "Ankle Dorsiflexion Stretch", 3, "10", "5-6", ctrl),
				// Mobility – Phase 2 (Variable)
				per(3, 22, "Hip Opener Stretch", 3, "12", "5-6", ctrl),
				per(4, 23, "Dynamic Lunge Stretch", 3, "12", "5-6", ctrl),
				// Mobility – Phase 3 (Variable)
				per(5, 24, "Deep Squat Hold", 3, "12", "6-7", ctrl),
				// Rehab – Phase 1 (Fixed)
				per(6, 25, "Clam Shell", 3, "12", "5-6", bandL),
				per(7, 26, "Side Walk Band", 3, "12", "5-6", bandL),
				// Rehab – Phase 2 (Variable)
				per(8, 27, "Single Leg Balance", 3, "12", "6-7", bandM),
				per(9, 28, "Step Down Control", 3, "12", "6-7", bandM),
				// Rehab – Phase 3 (Variable)
				per(10, 29, "Single Leg Reach", 3, "10", "6-7", bandM),
				// Strength – Phase 1 (Fixed)
				per(11, 30, "Hip Thrust", 3, "12", "5-6", bw),
				// Strength – Phase 2
				per(12, 31, "Static Squat", 3, "12", "6-7", dbM),
				per(13, 32, "Split Squat", 3, "12", "6-7", dbM),
				per(14, 33, "Step Up", 3, "12", "6-7", dbM),
				// Strength – Phase 3
				per(15, 34, "Single Leg Squat", 4, "8", "7-8", dbH),
				// Functional – Phase 1
				per(16, 35, "Balance Hold", 3, "20s", "5-6", bw),
				// Functional – Phase 2
				per(17, 36, "Step Pattern", 3, "12", "6-7", bandM),
				per(18, 37, "Lateral Movement", 3, "12", "6-7", bandM),
				// Functional – Phase 3
				per(19, 38, "Jump Landing Drill", 4, "8", "7-8", dbM),
				per(20, 39, "Reactive Hop", 4, "8", "7-8", dbM),
			},
		},

		// ── 3. KYPH-GEN: General / Kyphosis ─────────────────────────────────────
		{
			ProtocolId:   genID("prt", 11),
			Name:         "General Posture Kyphosis – KYPH-GEN",
			ProtocolCode: "KYPH-GEN",
			Description:  "General postural kyphosis protocol: thoracic opening, upper back activation, and functional carry.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_GENERAL,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_KYPHOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    createAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				// Mobility – Phase 1 (Fixed)
				per(1, 40, "Thoracic Breathing Opener", 3, "10", "5-6", ctrl),
				per(2, 41, "Wall Chest Opener", 3, "10", "5-6", ctrl),
				// Mobility – Phase 2 (Variable)
				per(3, 42, "Open Book Flow", 3, "12", "5-6", ctrl),
				// Rehab – Phase 1 (Fixed)
				per(4, 43, "Band Pull Apart", 3, "12", "5-6", bandL),
				// Rehab – Phase 2 (Variable)
				per(5, 44, "Serratus Wall Reach", 3, "12", "6-7", bandM),
				// Strength – Phase 1 (Fixed)
				per(6, 45, "Supported Row", 3, "12", "5-6", bw),
				// Strength – Phase 2 (Variable)
				per(7, 46, "Face Pull Light", 3, "12", "6-7", dbM),
				// Functional – Phase 3 (Variable)
				per(8, 47, "Carry with Posture Control", 4, "8", "7-8", dbM),
			},
		},

		// ── 4. LORD-GEN: General / Lordosis ──────────────────────────────────────
		{
			ProtocolId:   genID("prt", 12),
			Name:         "General Posture Lordosis – LORD-GEN",
			ProtocolCode: "LORD-GEN",
			Description:  "General postural lordosis protocol: pelvic reset, core activation, glute bridge, and loaded carry.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_GENERAL,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_LORDOSIS,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    createAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				// Mobility – Phase 1 (Fixed)
				per(1, 48, "90/90 Pelvic Reset", 3, "10", "5-6", ctrl),
				per(2, 49, "Hip Flexor Stretch", 3, "10", "5-6", ctrl),
				// Rehab – Phase 1 (Fixed)
				per(3, 50, "Posterior Pelvic Tilt Drill", 3, "12", "5-6", bandL),
				// Rehab – Phase 2 (Variable)
				per(4, 51, "Dead Bug Basic", 3, "12", "6-7", bandM),
				// Strength – Phase 1 (Fixed)
				per(5, 52, "Glute Bridge", 3, "12", "5-6", bw),
				// Strength – Phase 2 (Variable)
				per(6, 53, "Hamstring Curl Ball", 3, "12", "6-7", dbM),
				// Functional – Phase 3 (Variable)
				per(7, 54, "Farmer Carry Controlled", 4, "8", "7-8", dbM),
			},
		},

		// ── 5. PRON-GEN: General / Pronation ─────────────────────────────────────
		{
			ProtocolId:   genID("prt", 13),
			Name:         "General Posture Pronation – PRON-GEN",
			ProtocolCode: "PRON-GEN",
			Description:  "General postural foot pronation protocol: arch activation, balance, calf strength, and reactive balance.",
			Joint:        physio.PhysioJoint_PHYSIO_JOINT_GENERAL,
			Posture:      physio.PhysioPosture_PHYSIO_POSTURE_PRONATION,
			UserId:       "admin",
			IsActive:     true,
			AuditInfo:    createAuditInfo(),
			Exercises: []*physio.ProtocolExercise{
				// Mobility – Phase 1 (Fixed)
				per(1, 55, "Foot Tripod Drill", 3, "10", "5-6", ctrl),
				per(2, 56, "Calf Stretch Wall", 3, "10", "5-6", ctrl),
				// Rehab – Phase 1 (Fixed)
				per(3, 57, "Arch Control Hold", 3, "12", "5-6", bandL),
				// Rehab – Phase 2 (Variable)
				per(4, 58, "Single Leg Balance Arch", 3, "12", "6-7", bandM),
				// Strength – Phase 1 (Fixed)
				per(5, 59, "Calf Raise Controlled", 3, "12", "5-6", bw),
				// Strength – Phase 2 (Variable)
				per(6, 60, "Tibialis Raise Wall", 3, "12", "6-7", dbM),
				// Functional – Phase 3 (Variable)
				per(7, 61, "Reactive Balance Tap", 4, "8", "7-8", dbM),
			},
		},
	}
}

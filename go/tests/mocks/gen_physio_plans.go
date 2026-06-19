package mocks

import (
	"fmt"
	"strings"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
)

// generateCuratedHipPlan builds the real, hand-curated treatment plan
// "ירך מובילטי וחיזוק, פתיחת חזה וכוח כללי" — 18 exercises across 4 circuits
// (LORD-HIP Mobility, LORD-HIP Rehab, KYPH-SHO Mobility, GEN-GEN Strength).
// Exercises are resolved by name against exerciseByName so the plan stays
// correct if cex-NNN indices ever shift. Returns (plan, missingNames).
func generateCuratedHipPlan(clientID string, exerciseByName map[string]string) (*physio.TreatmentPlan, []string) {
	dumbbell := physio.PhysioLoadType_PHYSIO_LOAD_TYPE_DUMBBELL

	type peDef struct {
		name          string
		sets, reps    int32
		notes         string
		loadType      physio.PhysioLoadType
		weightKg      int32
		circuitNumber int32
		circuitLabel  string
	}

	defs := []peDef{
		// Circuit 1 — LORD-HIP — Mobility
		{"Glute massage", 3, 60, "seconds", 0, 0, 1, "LORD-HIP — Mobility"},
		{"Pigeon stretch", 3, 30, "seconds", 0, 0, 1, "LORD-HIP — Mobility"},
		{"Couch stretch", 3, 30, "seconds each side", 0, 0, 1, "LORD-HIP — Mobility"},
		{"90/90 Hip Rotations", 2, 20, "", 0, 0, 1, "LORD-HIP — Mobility"},
		{"Hip Internal Stretch 90/90", 2, 30, "seconds each side", 0, 0, 1, "LORD-HIP — Mobility"},
		{"Single-Leg Middle Split Stretch", 2, 30, "seconds each side", 0, 0, 1, "LORD-HIP — Mobility"},

		// Circuit 2 — LORD-HIP — Rehab
		{"Clam Shell", 3, 15, "", 0, 0, 2, "LORD-HIP — Rehab"},
		{"Hip Thrust with Ball Squeeze", 3, 12, "", 0, 8, 2, "LORD-HIP — Rehab"},
		{"PPT with Ball Squeeze", 3, 15, "", 0, 0, 2, "LORD-HIP — Rehab"},
		{"PPT Crunches with Ball Squeeze", 3, 12, "", 0, 0, 2, "LORD-HIP — Rehab"},
		{"Side Walk with Band", 3, 15, "", 0, 0, 2, "LORD-HIP — Rehab"},

		// Circuit 3 — KYPH-SHO — Mobility
		{"Thoracic Extension on Foam Roller", 2, 10, "", 0, 0, 3, "KYPH-SHO — Mobility"},
		{"Chest Opening on Swiss Ball", 2, 30, "", dumbbell, 1, 3, "KYPH-SHO — Mobility"},
		{"Stick Behind Back – ROM", 2, 15, "", 0, 0, 3, "KYPH-SHO — Mobility"},
		{"Trunk Rotation Next to Wall", 2, 10, "", 0, 0, 3, "KYPH-SHO — Mobility"},

		// Circuit 4 — GEN-GEN — Strength
		{"Wall Squat – Medial Head", 3, 45, "", dumbbell, 5, 4, "GEN-GEN — Strength"},
		{"TRX Row – Narrow Grip", 3, 10, "", 0, 0, 4, "GEN-GEN — Strength"},
		{"Push-Up on Knees", 3, 12, "", 0, 0, 4, "GEN-GEN — Strength"},
	}

	var missing []string
	exercises := make([]*physio.PlanExercise, 0, len(defs))
	orderInCircuit := map[int32]int32{}
	for _, d := range defs {
		exID, ok := exerciseByName[strings.ToLower(d.name)]
		if !ok {
			missing = append(missing, d.name)
			continue
		}
		orderInCircuit[d.circuitNumber]++
		exercises = append(exercises, &physio.PlanExercise{
			PlanExerciseId: fmt.Sprintf("pe-curated-c%d-%02d", d.circuitNumber, orderInCircuit[d.circuitNumber]),
			ExerciseId:     exID,
			Sets:           d.sets,
			Reps:           d.reps,
			Notes:          d.notes,
			OrderIndex:     orderInCircuit[d.circuitNumber],
			CircuitNumber:  d.circuitNumber,
			CircuitLabel:   d.circuitLabel,
			LoadType:       d.loadType,
			WeightKg:       d.weightKg,
		})
	}

	plan := &physio.TreatmentPlan{
		PlanId:    "plan-curated-hagar-hip",
		ClientId:  clientID,
		UserId:    "admin",
		Title:     "ירך מובילטי וחיזוק, פתיחת חזה וכוח כללי",
		Status:    physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE,
		StartDate: lm.RandomPastDate(1, 14),
		Exercises: exercises,
		AuditInfo: lm.CreateAuditInfo(),
	}
	return plan, missing
}

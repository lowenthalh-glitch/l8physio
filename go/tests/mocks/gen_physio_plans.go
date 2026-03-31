package mocks

import (
	"fmt"
	"math/rand"

	"github.com/saichler/l8physio/go/types/physio"
)

// generateTreatmentPlans creates 20 treatment plans distributed across clients
// Status distribution: 60% Active, 20% Completed, 10% Draft, 10% Suspended
func generateTreatmentPlans(store *MockDataStore) []*physio.TreatmentPlan {
	plans := make([]*physio.TreatmentPlan, 20)

	for i := 0; i < 20; i++ {
		clientID := pickRef(store.PhysioClientIDs, i)

		var status physio.PhysioPlanStatus
		switch {
		case i < 12:
			status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE
		case i < 16:
			status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_COMPLETED
		case i < 18:
			status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_DRAFT
		default:
			status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_SUSPENDED
		}

		startDate := randomPastDate(6)
		var endDate int64
		if status == physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_COMPLETED {
			endDate = startDate + int64(rand.Intn(60)+30)*86400 // 30-90 days after start
		} else {
			endDate = randomFutureDate(3)
		}

		// Attach 3-5 exercises per plan
		numExercises := rand.Intn(3) + 3
		exercises := make([]*physio.PlanExercise, numExercises)
		for j := 0; j < numExercises; j++ {
			exIdx := (i*7 + j) % len(store.PhysioExerciseIDs)
			exercises[j] = &physio.PlanExercise{
				PlanExerciseId: fmt.Sprintf("pe-%03d-%02d", i+1, j+1),
				ExerciseId:     pickRef(store.PhysioExerciseIDs, exIdx),
				Sets:           int32(rand.Intn(3) + 2),
				Reps:           int32(rand.Intn(10) + 10),
				HoldSeconds:    int32(rand.Intn(3)) * 10,
				Frequency:      physio.PhysioFrequency(rand.Intn(4) + 1),
				OrderIndex:     int32(j + 1),
			}
		}

		plans[i] = &physio.TreatmentPlan{
			PlanId:         genID("plan", i),
			ClientId:       clientID,
			UserId:         "admin",
			Title:          planTitles[i%len(planTitles)],
			Description:    fmt.Sprintf("Comprehensive treatment plan addressing %s.", diagnoses[i%len(diagnoses)]),
			Status:         status,
			StartDate:      startDate,
			EndDate:        endDate,
			Goals:          fmt.Sprintf("Reduce pain to 2/10. Restore full functional range of motion. Return to normal daily activities within %d weeks.", rand.Intn(6)+6),
			TherapistNotes: fmt.Sprintf("Initial assessment completed. Plan tailored to client presentation of %s.", diagnoses[i%len(diagnoses)]),
			Exercises:      exercises,
			AuditInfo:      createAuditInfo(),
		}
	}

	return plans
}

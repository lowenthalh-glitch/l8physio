package mocks

import (
	"fmt"
	"math/rand"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// generateProgressLogs creates 50 progress log records linked to completed appointments
func generateProgressLogs(store *MockDataStore) []*physio.ProgressLog {
	logs := make([]*physio.ProgressLog, 50)

	for i := 0; i < 50; i++ {
		clientID := lm.PickRef(store.PhysioClientIDs, i)
		planID := lm.PickRef(store.TreatmentPlanIDs, i)
		apptID := lm.PickRef(store.AppointmentIDs, i)

		// Pain level improves over time (later logs have lower pain)
		painLevel := int32(rand.Intn(5) + 1) // 1-5 initially
		if i > 25 {
			painLevel = int32(rand.Intn(3) + 1) // 1-3 as treatment progresses
		}

		// Generate 2-4 exercise progress entries per log
		numEntries := rand.Intn(3) + 2
		entries := make([]*physio.ProgressEntry, numEntries)
		for j := 0; j < numEntries; j++ {
			exIdx := (i*5 + j) % len(store.PhysioExerciseIDs)
			exerciseID := lm.PickRef(store.PhysioExerciseIDs, exIdx)
			setsPrescribed := int32(rand.Intn(2) + 3)
			repsPrescribed := int32(rand.Intn(5) + 10)
			completed := rand.Float32() > 0.2 // 80% completion rate

			setsDone := setsPrescribed
			repsDone := repsPrescribed
			if !completed {
				setsDone = setsPrescribed - 1
				repsDone = repsPrescribed - int32(rand.Intn(5)+1)
			}

			entries[j] = &physio.ProgressEntry{
				ProgressEntryId:     fmt.Sprintf("pe-%03d-%02d", i+1, j+1),
				ExerciseId:          exerciseID,
				Completed:           completed,
				SetsDone:            setsDone,
				RepsDone:            repsDone,
				PainLevel:           int32(rand.Intn(4) + 1),
				ClientNotes:         "Performed as instructed.",
				SetsPrescribed:      setsPrescribed,
				RepsPrescribed:      repsPrescribed,
				HoldPrescribed:      int32(rand.Intn(3)) * 10,
				FrequencyPrescribed: physio.PhysioFrequency(rand.Intn(4) + 1),
			}
		}

		logs[i] = &physio.ProgressLog{
			LogId:            lm.GenID("log", i),
			ClientId:         clientID,
			UserId:           "admin",
			PlanId:           planID,
			ApptId:           apptID,
			LogDate:          lm.RandomPastDate(3, 28),
			OverallPainLevel: painLevel,
			GeneralNotes:     progressNotes[i%len(progressNotes)],
			Entries:          entries,
			AuditInfo:        lm.CreateAuditInfo(),
		}
	}

	return logs
}

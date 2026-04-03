package progress

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/physio/exercises"
	"github.com/saichler/l8physio/go/physio/plans"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyLogServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"ProgressLog",
		func(e interface{}) bool { _, ok := e.(*physio.ProgressLog); return ok },
		setPhyLogID,
		validatePhyLog,
		snapshotExerciseDataOnPost,
	)
}

func setPhyLogID(e interface{}) {
	entity := e.(*physio.ProgressLog)
	l8c.GenerateID(&entity.LogId)
	for _, entry := range entity.Entries {
		l8c.GenerateID(&entry.ProgressEntryId)
	}
}

func validatePhyLog(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.ProgressLog)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.PlanId, "PlanId"); err != nil {
		return err
	}
	if err := l8c.ValidateDateNotZero(entity.LogDate, "LogDate"); err != nil {
		return err
	}
	return nil
}

// snapshotExerciseDataOnPost runs on POST only to capture the prescribed exercise
// parameters from the TreatmentPlan and PhysioExercise into each ProgressEntry.
// This preserves the historical context even if the plan is later modified.
func snapshotExerciseDataOnPost(e interface{}, action ifs.Action, vnic ifs.IVNic) error {
	if action != ifs.POST {
		return nil
	}
	entity := e.(*physio.ProgressLog)
	if len(entity.Entries) == 0 {
		return nil
	}

	// Fetch the TreatmentPlan to get prescribed parameters per exercise
	plan, err := plans.Plan(entity.PlanId, vnic)
	if err != nil || plan == nil {
		// Non-fatal: log a warning but allow the record to be saved
		return nil
	}

	// Build a lookup map: exerciseId -> PlanExercise
	planExerciseMap := make(map[string]*physio.PlanExercise)
	for _, pe := range plan.Exercises {
		planExerciseMap[pe.ExerciseId] = pe
	}

	// For each progress entry, snapshot exercise name and prescribed parameters
	for _, entry := range entity.Entries {
		if entry.ExerciseId == "" {
			continue
		}

		// Fetch the exercise name
		exercise, err := exercises.Exercise(entry.ExerciseId, vnic)
		if err == nil && exercise != nil {
			entry.ExerciseName = exercise.Name
		}

		// Snapshot prescribed parameters from the plan
		if pe, ok := planExerciseMap[entry.ExerciseId]; ok {
			entry.SetsPrescribed = pe.Sets
			entry.RepsPrescribed = pe.Reps
			entry.HoldPrescribed = pe.HoldSeconds
			entry.FrequencyPrescribed = pe.Frequency
		}
	}

	return nil
}

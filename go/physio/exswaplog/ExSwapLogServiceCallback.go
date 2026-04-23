package exswaplog

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newExSwapLogServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"ExerciseSwapLog",
		func(e interface{}) bool { _, ok := e.(*physio.ExerciseSwapLog); return ok },
		setExSwapLogID,
		validateExSwapLog,
	)
}

func setExSwapLogID(e interface{}) {
	entity := e.(*physio.ExerciseSwapLog)
	l8c.GenerateID(&entity.SwapId)
}

func validateExSwapLog(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.ExerciseSwapLog)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.PlanId, "PlanId"); err != nil {
		return err
	}
	// OldExerciseId and NewExerciseId are optional — empty for add/delete operations
	return nil
}

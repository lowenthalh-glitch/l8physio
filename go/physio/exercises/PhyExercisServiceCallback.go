package exercises

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyExercisServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.PhysioExercise](
		"PhysioExercise",
		setPhyExercisID,
		validatePhyExercis,
	)
}

func setPhyExercisID(entity *physio.PhysioExercise) {
	erpc.GenerateID(&entity.ExerciseId)
}

func validatePhyExercis(entity *physio.PhysioExercise, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.Name, "Name"); err != nil {
		return err
	}
	return nil
}

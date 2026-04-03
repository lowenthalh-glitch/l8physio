package exercises

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyExercisServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"PhysioExercise",
		func(e interface{}) bool { _, ok := e.(*physio.PhysioExercise); return ok },
		setPhyExercisID,
		validatePhyExercis,
	)
}

func setPhyExercisID(e interface{}) {
	entity := e.(*physio.PhysioExercise)
	l8c.GenerateID(&entity.ExerciseId)
}

func validatePhyExercis(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.PhysioExercise)
	if err := l8c.ValidateRequired(entity.Name, "Name"); err != nil {
		return err
	}
	return nil
}

package exercises

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
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
	// Backward compat: migrate single joint/category to repeated lists
	if len(entity.Joints) == 0 && entity.Joint != physio.PhysioJoint_PHYSIO_JOINT_UNSPECIFIED {
		entity.Joints = []physio.PhysioJoint{entity.Joint}
	}
	if len(entity.Categories) == 0 && entity.Category != physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_UNSPECIFIED {
		entity.Categories = []physio.PhysioExerciseCategory{entity.Category}
	}
	return nil
}

package exercises

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyExercis"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "ExerciseId", newPhyExercisServiceCallback(),
			&physio.PhysioExercise{}, &physio.PhysioExerciseList{}),
		creds, dbname, vnic)
}

func Exercises(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Exercise(exerciseId string, vnic ifs.IVNic) (*physio.PhysioExercise, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.PhysioExercise{ExerciseId: exerciseId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.PhysioExercise)
	if !ok || entity == nil {
		return nil, errors.New("PhysioExercise not found")
	}
	return entity, nil
}

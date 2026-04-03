package exercises

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyExercis"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ExerciseId", Callback: newPhyExercisServiceCallback(),
	}, &physio.PhysioExercise{}, &physio.PhysioExerciseList{}, creds, dbname, vnic)
}

func Exercises(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Exercise(exerciseId string, vnic ifs.IVNic) (*physio.PhysioExercise, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.PhysioExercise{ExerciseId: exerciseId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.PhysioExercise), nil
}

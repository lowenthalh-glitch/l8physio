package exercises

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyExercis"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.PhysioExercise, physio.PhysioExerciseList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ExerciseId", Callback: newPhyExercisServiceCallback(),
	}, creds, dbname, vnic)
}

func Exercises(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Exercise(exerciseId string, vnic ifs.IVNic) (*physio.PhysioExercise, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.PhysioExercise{ExerciseId: exerciseId}, vnic)
}

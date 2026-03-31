package workout

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyWorkout"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.GeneratedWorkout, physio.GeneratedWorkoutList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "WorkoutId", Callback: newPhyWorkoutServiceCallback(),
	}, creds, dbname, vnic)
}

func Workouts(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Workout(workoutId string, vnic ifs.IVNic) (*physio.GeneratedWorkout, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.GeneratedWorkout{WorkoutId: workoutId}, vnic)
}

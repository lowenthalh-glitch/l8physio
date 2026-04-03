package workout

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyWorkout"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "WorkoutId", Callback: newPhyWorkoutServiceCallback(),
	}, &physio.GeneratedWorkout{}, &physio.GeneratedWorkoutList{}, creds, dbname, vnic)
}

func Workouts(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Workout(workoutId string, vnic ifs.IVNic) (*physio.GeneratedWorkout, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.GeneratedWorkout{WorkoutId: workoutId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.GeneratedWorkout), nil
}

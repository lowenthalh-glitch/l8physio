package workout

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyWorkout"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "WorkoutId", newPhyWorkoutServiceCallback(),
			&physio.GeneratedWorkout{}, &physio.GeneratedWorkoutList{}),
		creds, dbname, vnic)
}

func Workouts(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Workout(workoutId string, vnic ifs.IVNic) (*physio.GeneratedWorkout, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.GeneratedWorkout{WorkoutId: workoutId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.GeneratedWorkout)
	if !ok || entity == nil {
		return nil, errors.New("GeneratedWorkout not found")
	}
	return entity, nil
}

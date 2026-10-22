package appointments

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyApptServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"Appointment",
		func(e interface{}) bool { _, ok := e.(*physio.Appointment); return ok },
		setPhyApptID,
		validatePhyAppt,
	)
}

func setPhyApptID(e interface{}) {
	entity := e.(*physio.Appointment)
	l8c.GenerateID(&entity.ApptId)
}

func validatePhyAppt(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.Appointment)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	// The generic edit form does not carry userId and posts date-only start/end;
	// a PUT keeps the stored userId and the stored time of day.
	if entity.ApptId != "" {
		if found, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.Appointment{ApptId: entity.ApptId}, vnic); err == nil {
			if stored, ok := found.(*physio.Appointment); ok && stored != nil {
				if entity.UserId == "" {
					entity.UserId = stored.UserId
				}
				entity.StartTime = keepTimeOfDay(entity.StartTime, stored.StartTime)
				entity.EndTime = keepTimeOfDay(entity.EndTime, stored.EndTime)
			}
		}
	}
	if err := l8c.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	if err := l8c.ValidateDateNotZero(entity.StartTime, "StartTime"); err != nil {
		return err
	}
	if err := l8c.ValidateDateNotZero(entity.EndTime, "EndTime"); err != nil {
		return err
	}
	if entity.StartTime >= entity.EndTime {
		return l8c.ValidateDateAfter(entity.EndTime, entity.StartTime, "EndTime", "StartTime")
	}
	return nil
}

const secondsPerDay = 86400

// keepTimeOfDay re-applies the stored time of day to a submitted value that is a bare date (midnight).
func keepTimeOfDay(submitted, stored int64) int64 {
	if submitted > 0 && submitted%secondsPerDay == 0 {
		return submitted + stored%secondsPerDay
	}
	return submitted
}

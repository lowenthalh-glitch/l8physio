package appointments

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
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

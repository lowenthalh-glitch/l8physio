package appointments

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyApptServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.Appointment](
		"Appointment",
		setPhyApptID,
		validatePhyAppt,
	)
}

func setPhyApptID(entity *physio.Appointment) {
	erpc.GenerateID(&entity.ApptId)
}

func validatePhyAppt(entity *physio.Appointment, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	if err := erpc.ValidateDateNotZero(entity.StartTime, "StartTime"); err != nil {
		return err
	}
	if err := erpc.ValidateDateNotZero(entity.EndTime, "EndTime"); err != nil {
		return err
	}
	if entity.StartTime >= entity.EndTime {
		return erpc.ValidateDateAfter(entity.EndTime, entity.StartTime, "EndTime", "StartTime")
	}
	return nil
}

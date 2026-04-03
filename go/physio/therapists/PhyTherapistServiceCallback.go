package therapists

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyTherapistServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"PhysioTherapist",
		func(e interface{}) bool { _, ok := e.(*physio.PhysioTherapist); return ok },
		setPhyTherapistID,
		validatePhyTherapist,
	)
}

func setPhyTherapistID(e interface{}) {
	entity := e.(*physio.PhysioTherapist)
	l8c.GenerateID(&entity.TherapistId)
}

func validatePhyTherapist(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.PhysioTherapist)
	if err := l8c.ValidateRequired(entity.FirstName, "FirstName"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.LastName, "LastName"); err != nil {
		return err
	}
	return nil
}

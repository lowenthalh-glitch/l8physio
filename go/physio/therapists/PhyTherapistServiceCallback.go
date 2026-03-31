package therapists

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyTherapistServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.PhysioTherapist](
		"PhysioTherapist",
		setPhyTherapistID,
		validatePhyTherapist,
	)
}

func setPhyTherapistID(entity *physio.PhysioTherapist) {
	erpc.GenerateID(&entity.TherapistId)
}

func validatePhyTherapist(entity *physio.PhysioTherapist, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.FirstName, "FirstName"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.LastName, "LastName"); err != nil {
		return err
	}
	return nil
}

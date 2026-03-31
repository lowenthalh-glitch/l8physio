package plans

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyPlanServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.TreatmentPlan](
		"TreatmentPlan",
		setPhyPlanID,
		validatePhyPlan,
	)
}

func setPhyPlanID(entity *physio.TreatmentPlan) {
	erpc.GenerateID(&entity.PlanId)
}

func validatePhyPlan(entity *physio.TreatmentPlan, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.Title, "Title"); err != nil {
		return err
	}
	return nil
}

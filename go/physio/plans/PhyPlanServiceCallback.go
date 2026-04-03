package plans

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyPlanServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"TreatmentPlan",
		func(e interface{}) bool { _, ok := e.(*physio.TreatmentPlan); return ok },
		setPhyPlanID,
		validatePhyPlan,
	)
}

func setPhyPlanID(e interface{}) {
	entity := e.(*physio.TreatmentPlan)
	l8c.GenerateID(&entity.PlanId)
}

func validatePhyPlan(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.TreatmentPlan)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.Title, "Title"); err != nil {
		return err
	}
	return nil
}

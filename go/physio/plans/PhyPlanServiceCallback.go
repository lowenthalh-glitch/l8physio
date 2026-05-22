package plans

import (
	"fmt"

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
		supersedePriorActivePlans,
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

// supersedePriorActivePlans flips any existing Active plan for the same client
// to Completed when a new Active plan is created. Without this, repeated Assigns
// (e.g. from the standalone Workout Builder, which always posts a fresh plan)
// leave multiple Active plans for one client.
func supersedePriorActivePlans(e interface{}, action ifs.Action, vnic ifs.IVNic) error {
	if action != ifs.POST {
		return nil
	}
	incoming := e.(*physio.TreatmentPlan)
	if incoming.Status != physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE || incoming.ClientId == "" {
		return nil
	}
	existing, err := l8c.GetEntities(ServiceName, ServiceArea, &physio.TreatmentPlan{ClientId: incoming.ClientId}, vnic)
	if err != nil {
		fmt.Println("[PhyPlan] supersede: lookup failed:", err.Error())
		return nil
	}
	for _, raw := range existing {
		prior, ok := raw.(*physio.TreatmentPlan)
		if !ok || prior == nil {
			continue
		}
		if prior.PlanId == incoming.PlanId {
			continue
		}
		if prior.Status != physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE {
			continue
		}
		prior.Status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_COMPLETED
		if err := l8c.PutEntity(ServiceName, ServiceArea, prior, vnic); err != nil {
			fmt.Println("[PhyPlan] supersede: failed to complete prior plan", prior.PlanId, ":", err.Error())
		}
	}
	return nil
}

package plans

import (
	"fmt"

	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyPlan"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "PlanId", Callback: newPhyPlanServiceCallback(),
	}, &physio.TreatmentPlan{}, &physio.TreatmentPlanList{}, creds, dbname, vnic)

	go CleanupDuplicateActivePlans(vnic)
}

// CleanupDuplicateActivePlans is a one-shot retroactive fix: for every client
// with more than one Active TreatmentPlan, keep the one with the latest
// StartDate (PlanId as tiebreaker) and mark the rest Completed. Safe to call
// repeatedly — does nothing once each client has at most one Active plan.
func CleanupDuplicateActivePlans(vnic ifs.IVNic) {
	all, err := l8c.GetEntities(ServiceName, ServiceArea, &physio.TreatmentPlan{}, vnic)
	if err != nil {
		fmt.Println("[PhyPlan] cleanup: lookup failed:", err.Error())
		return
	}
	byClient := make(map[string][]*physio.TreatmentPlan)
	for _, raw := range all {
		p, ok := raw.(*physio.TreatmentPlan)
		if !ok || p == nil {
			continue
		}
		if p.Status != physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE || p.ClientId == "" {
			continue
		}
		byClient[p.ClientId] = append(byClient[p.ClientId], p)
	}
	completed := 0
	for clientId, plans := range byClient {
		if len(plans) <= 1 {
			continue
		}
		keep := plans[0]
		for _, p := range plans[1:] {
			if p.StartDate > keep.StartDate || (p.StartDate == keep.StartDate && p.PlanId > keep.PlanId) {
				keep = p
			}
		}
		for _, p := range plans {
			if p.PlanId == keep.PlanId {
				continue
			}
			p.Status = physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_COMPLETED
			if err := l8c.PutEntity(ServiceName, ServiceArea, p, vnic); err != nil {
				fmt.Println("[PhyPlan] cleanup: failed to complete", p.PlanId, "for client", clientId, ":", err.Error())
				continue
			}
			completed++
		}
	}
	if completed > 0 {
		fmt.Println("[PhyPlan] cleanup: completed", completed, "duplicate active plan(s)")
	}
}

func Plans(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Plan(planId string, vnic ifs.IVNic) (*physio.TreatmentPlan, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.TreatmentPlan{PlanId: planId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.TreatmentPlan), nil
}

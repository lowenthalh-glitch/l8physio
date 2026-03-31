package plans

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyPlan"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.TreatmentPlan, physio.TreatmentPlanList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "PlanId", Callback: newPhyPlanServiceCallback(),
	}, creds, dbname, vnic)
}

func Plans(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Plan(planId string, vnic ifs.IVNic) (*physio.TreatmentPlan, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.TreatmentPlan{PlanId: planId}, vnic)
}

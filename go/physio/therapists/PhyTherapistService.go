package therapists

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyTherapt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.PhysioTherapist, physio.PhysioTherapistList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "TherapistId", Callback: newPhyTherapistServiceCallback(),
	}, creds, dbname, vnic)
}

package clients

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyClient"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.PhysioClient, physio.PhysioClientList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ClientId", Callback: newPhyClientServiceCallback(),
	}, creds, dbname, vnic)
}

func Clients(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Client(clientId string, vnic ifs.IVNic) (*physio.PhysioClient, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.PhysioClient{ClientId: clientId}, vnic)
}

package clients

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyClient"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ClientId", Callback: newPhyClientServiceCallback(),
	}, &physio.PhysioClient{}, &physio.PhysioClientList{}, creds, dbname, vnic)
}

func Clients(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Client(clientId string, vnic ifs.IVNic) (*physio.PhysioClient, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.PhysioClient{ClientId: clientId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.PhysioClient), nil
}

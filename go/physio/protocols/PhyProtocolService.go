package protocols

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyProto"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.PhysioProtocol, physio.PhysioProtocolList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ProtocolId", Callback: newPhyProtocolServiceCallback(),
	}, creds, dbname, vnic)
}

func Protocols(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Protocol(protocolId string, vnic ifs.IVNic) (*physio.PhysioProtocol, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.PhysioProtocol{ProtocolId: protocolId}, vnic)
}

package protocols

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyProto"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "ProtocolId", newPhyProtocolServiceCallback(),
			&physio.PhysioProtocol{}, &physio.PhysioProtocolList{}),
		creds, dbname, vnic)
}

func Protocols(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Protocol(protocolId string, vnic ifs.IVNic) (*physio.PhysioProtocol, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.PhysioProtocol{ProtocolId: protocolId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.PhysioProtocol)
	if !ok || entity == nil {
		return nil, errors.New("PhysioProtocol not found")
	}
	return entity, nil
}

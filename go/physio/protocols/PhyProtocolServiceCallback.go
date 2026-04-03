package protocols

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyProtocolServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"PhysioProtocol",
		func(e interface{}) bool { _, ok := e.(*physio.PhysioProtocol); return ok },
		setPhyProtocolID,
		validatePhyProtocol,
	)
}

func setPhyProtocolID(e interface{}) {
	entity := e.(*physio.PhysioProtocol)
	l8c.GenerateID(&entity.ProtocolId)
}

func validatePhyProtocol(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.PhysioProtocol)
	if err := l8c.ValidateRequired(entity.Name, "Name"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	return nil
}

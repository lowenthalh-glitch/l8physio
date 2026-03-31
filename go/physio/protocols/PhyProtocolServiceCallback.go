package protocols

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyProtocolServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.PhysioProtocol](
		"PhysioProtocol",
		setPhyProtocolID,
		validatePhyProtocol,
	)
}

func setPhyProtocolID(entity *physio.PhysioProtocol) {
	erpc.GenerateID(&entity.ProtocolId)
}

func validatePhyProtocol(entity *physio.PhysioProtocol, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.Name, "Name"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.UserId, "UserId"); err != nil {
		return err
	}
	return nil
}

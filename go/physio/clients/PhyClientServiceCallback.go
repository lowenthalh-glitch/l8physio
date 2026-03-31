package clients

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyClientServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.PhysioClient](
		"PhysioClient",
		setPhyClientID,
		validatePhyClient,
	)
}

func setPhyClientID(entity *physio.PhysioClient) {
	erpc.GenerateID(&entity.ClientId)
}

func validatePhyClient(entity *physio.PhysioClient, vnic ifs.IVNic) error {
	if err := erpc.ValidateRequired(entity.FirstName, "FirstName"); err != nil {
		return err
	}
	if err := erpc.ValidateRequired(entity.LastName, "LastName"); err != nil {
		return err
	}
	return nil
}

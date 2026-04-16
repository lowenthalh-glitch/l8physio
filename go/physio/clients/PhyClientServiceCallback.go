package clients

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyClientServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"PhysioClient",
		func(e interface{}) bool { _, ok := e.(*physio.PhysioClient); return ok },
		setPhyClientID,
		validatePhyClient,
		setClientUserId,
	)
}

func setPhyClientID(e interface{}) {
	entity := e.(*physio.PhysioClient)
	l8c.GenerateID(&entity.ClientId)
}

func validatePhyClient(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.PhysioClient)
	if err := l8c.ValidateRequired(entity.FirstName, "FirstName"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.LastName, "LastName"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.Email, "Email"); err != nil {
		return err
	}
	return nil
}

func setClientUserId(e interface{}, action ifs.Action, vnic ifs.IVNic) error {
	if action != ifs.POST {
		return nil
	}
	client := e.(*physio.PhysioClient)
	client.UserId = client.Email
	return nil
}

package ovrdlog

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newOvrdLogServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"StatusOverrideLog",
		func(e interface{}) bool { _, ok := e.(*physio.StatusOverrideLog); return ok },
		setOvrdLogID,
		validateOvrdLog,
	)
}

func setOvrdLogID(e interface{}) {
	entity := e.(*physio.StatusOverrideLog)
	l8c.GenerateID(&entity.OverrideId)
}

func validateOvrdLog(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.StatusOverrideLog)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	return nil
}

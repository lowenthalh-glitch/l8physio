package sessionreport

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newSessRptServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"SessionReport",
		func(e interface{}) bool { _, ok := e.(*physio.SessionReport); return ok },
		setSessRptID,
		validateSessRpt,
	)
}

func setSessRptID(e interface{}) {
	entity := e.(*physio.SessionReport)
	l8c.GenerateID(&entity.ReportId)
}

func validateSessRpt(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.SessionReport)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	if err := l8c.ValidateRequired(entity.TherapistId, "TherapistId"); err != nil {
		return err
	}
	return nil
}

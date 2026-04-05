package homefeedback

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newHomeFdbkServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"HomeFeedback",
		func(e interface{}) bool { _, ok := e.(*physio.HomeFeedback); return ok },
		setHomeFdbkID,
		validateHomeFdbk,
	)
}

func setHomeFdbkID(e interface{}) {
	entity := e.(*physio.HomeFeedback)
	l8c.GenerateID(&entity.FeedbackId)
}

func validateHomeFdbk(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.HomeFeedback)
	if err := l8c.ValidateRequired(entity.ClientId, "ClientId"); err != nil {
		return err
	}
	return nil
}

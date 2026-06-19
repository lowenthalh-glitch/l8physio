package homefeedback

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
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
	entity.Status = computeFdbkStatus(entity)
	return nil
}

// computeFdbkStatus derives the session status from difficulty + pain values.
// Single source of truth for all clients (desktop, mobile, future API consumers).
//   RED    (3): difficulty 1 or 4, painDuring >= 3, or painAfter >= 3
//   YELLOW (2): difficulty 2, painDuring in 1-2, or painAfter in 1-2
//   GREEN  (1): otherwise (difficulty 3, no pain)
func computeFdbkStatus(e *physio.HomeFeedback) physio.SessionStatus {
	d := int32(e.Difficulty)
	pd := e.PainDuring
	pa := e.PainAfter
	if d == 1 || d == 4 || pd >= 3 || pa >= 3 {
		return physio.SessionStatus_SESSION_STATUS_RED
	}
	if d == 2 || (pd >= 1 && pd <= 2) || (pa >= 1 && pa <= 2) {
		return physio.SessionStatus_SESSION_STATUS_YELLOW
	}
	return physio.SessionStatus_SESSION_STATUS_GREEN
}

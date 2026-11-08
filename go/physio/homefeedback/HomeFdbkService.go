package homefeedback

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "HomeFdbk"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "FeedbackId", newHomeFdbkServiceCallback(),
			&physio.HomeFeedback{}, &physio.HomeFeedbackList{}),
		creds, dbname, vnic)
}

func Feedbacks(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Feedback(feedbackId string, vnic ifs.IVNic) (*physio.HomeFeedback, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.HomeFeedback{FeedbackId: feedbackId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.HomeFeedback)
	if !ok || entity == nil {
		return nil, errors.New("HomeFeedback not found")
	}
	return entity, nil
}

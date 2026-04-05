package homefeedback

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "HomeFdbk"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "FeedbackId", Callback: newHomeFdbkServiceCallback(),
	}, &physio.HomeFeedback{}, &physio.HomeFeedbackList{}, creds, dbname, vnic)
}

func Feedbacks(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Feedback(feedbackId string, vnic ifs.IVNic) (*physio.HomeFeedback, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.HomeFeedback{FeedbackId: feedbackId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.HomeFeedback), nil
}

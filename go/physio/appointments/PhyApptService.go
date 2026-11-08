package appointments

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyAppt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "ApptId", newPhyApptServiceCallback(),
			&physio.Appointment{}, &physio.AppointmentList{}),
		creds, dbname, vnic)
}

func Appointments(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Appointment(apptId string, vnic ifs.IVNic) (*physio.Appointment, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.Appointment{ApptId: apptId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.Appointment)
	if !ok || entity == nil {
		return nil, errors.New("Appointment not found")
	}
	return entity, nil
}

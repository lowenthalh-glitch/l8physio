package appointments

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyAppt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ApptId", Callback: newPhyApptServiceCallback(),
	}, &physio.Appointment{}, &physio.AppointmentList{}, creds, dbname, vnic)
}

func Appointments(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Appointment(apptId string, vnic ifs.IVNic) (*physio.Appointment, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.Appointment{ApptId: apptId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.Appointment), nil
}

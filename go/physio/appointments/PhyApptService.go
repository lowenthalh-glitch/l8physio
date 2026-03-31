package appointments

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyAppt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.Appointment, physio.AppointmentList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ApptId", Callback: newPhyApptServiceCallback(),
	}, creds, dbname, vnic)
}

func Appointments(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Appointment(apptId string, vnic ifs.IVNic) (*physio.Appointment, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.Appointment{ApptId: apptId}, vnic)
}

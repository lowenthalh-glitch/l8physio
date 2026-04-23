package htdash

import (
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8srlz/go/serialize/object"
	l8api "github.com/saichler/l8types/go/types/l8api"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/web"
)

const (
	ServiceName = "HTDash"
	ServiceArea = byte(50)
)

// HTDashService is a custom IServiceHandler (AlmOverlay pattern).
// It computes dashboard data in-memory on each GET by querying other ORM-backed services.
// No database table, no ORM writes.
type HTDashService struct {
	serviceName string
	serviceArea byte
	vnic        ifs.IVNic
}

func Activate(creds, dbname string, vnic ifs.IVNic) {
	svc := &HTDashService{vnic: vnic}
	sla := ifs.NewServiceLevelAgreement(svc, ServiceName, ServiceArea, true, nil)
	sla.SetServiceItem(&physio.HeadThDashRow{})
	sla.SetServiceItemList(&physio.HeadThDashRowList{})

	ws := web.New(ServiceName, ServiceArea, 0)
	ws.AddEndpoint(&l8api.L8Query{}, ifs.GET, &physio.HeadThDashRowList{})
	sla.SetWebService(ws)

	vnic.Resources().Services().Activate(sla, vnic)
}

func (s *HTDashService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	s.serviceName = sla.ServiceName()
	s.serviceArea = sla.ServiceArea()
	return nil
}

func (s *HTDashService) DeActivate() error { return nil }

func (s *HTDashService) Get(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	rows := computeDashboardRows(vnic)
	return object.New(nil, &physio.HeadThDashRowList{List: rows})
}

func (s *HTDashService) Post(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.NewError("HTDash is read-only")
}

func (s *HTDashService) Put(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.NewError("HTDash is read-only")
}

func (s *HTDashService) Patch(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.NewError("HTDash is read-only")
}

func (s *HTDashService) Delete(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.NewError("HTDash is read-only")
}

func (s *HTDashService) Failed(elements ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return nil
}

func (s *HTDashService) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

func (s *HTDashService) WebService() ifs.IWebService {
	ws := web.New(s.serviceName, s.serviceArea, 0)
	ws.AddEndpoint(&l8api.L8Query{}, ifs.GET, &physio.HeadThDashRowList{})
	return ws
}

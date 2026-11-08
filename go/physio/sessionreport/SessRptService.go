package sessionreport

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "SessRpt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "ReportId", newSessRptServiceCallback(),
			&physio.SessionReport{}, &physio.SessionReportList{}),
		creds, dbname, vnic)
}

func Reports(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Report(reportId string, vnic ifs.IVNic) (*physio.SessionReport, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.SessionReport{ReportId: reportId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.SessionReport)
	if !ok || entity == nil {
		return nil, errors.New("SessionReport not found")
	}
	return entity, nil
}

package sessionreport

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "SessRpt"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "ReportId", Callback: newSessRptServiceCallback(),
	}, &physio.SessionReport{}, &physio.SessionReportList{}, creds, dbname, vnic)
}

func Reports(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Report(reportId string, vnic ifs.IVNic) (*physio.SessionReport, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.SessionReport{ReportId: reportId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.SessionReport), nil
}

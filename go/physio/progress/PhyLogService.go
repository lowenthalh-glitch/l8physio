package progress

import (
	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyLog"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	erpc.ActivateService[physio.ProgressLog, physio.ProgressLogList](erpc.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "LogId", Callback: newPhyLogServiceCallback(),
	}, creds, dbname, vnic)
}

func Logs(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Log(logId string, vnic ifs.IVNic) (*physio.ProgressLog, error) {
	return erpc.GetEntity(ServiceName, ServiceArea, &physio.ProgressLog{LogId: logId}, vnic)
}

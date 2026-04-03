package progress

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyLog"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(l8c.ServiceConfig{
		ServiceName: ServiceName, ServiceArea: ServiceArea,
		PrimaryKey: "LogId", Callback: newPhyLogServiceCallback(),
	}, &physio.ProgressLog{}, &physio.ProgressLogList{}, creds, dbname, vnic)
}

func Logs(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Log(logId string, vnic ifs.IVNic) (*physio.ProgressLog, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.ProgressLog{LogId: logId}, vnic)
	if err != nil {
		return nil, err
	}
	return result.(*physio.ProgressLog), nil
}

package progress

import (
	"errors"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "PhyLog"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "LogId", newPhyLogServiceCallback(),
			&physio.ProgressLog{}, &physio.ProgressLogList{}),
		creds, dbname, vnic)
}

func Logs(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
	return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}

func Log(logId string, vnic ifs.IVNic) (*physio.ProgressLog, error) {
	result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.ProgressLog{LogId: logId}, vnic)
	if err != nil {
		return nil, err
	}
	// GetEntity answers nil for an unknown id: a bare type assertion would panic the whole service
	entity, ok := result.(*physio.ProgressLog)
	if !ok || entity == nil {
		return nil, errors.New("ProgressLog not found")
	}
	return entity, nil
}

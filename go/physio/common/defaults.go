package common

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8services/go/services/manager"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/sec"
	"github.com/saichler/l8utils/go/utils/logger"
	"github.com/saichler/l8utils/go/utils/registry"
	"github.com/saichler/l8utils/go/utils/resources"
)

const (
	PREFIX = "/physio/"
)

var DB_CREDS = "postgres"
var DB_NAME = "admin"

func CreateResources(alias string, logVnet bool) ifs.IResources {
	log := logger.NewLoggerImpl(&logger.FmtLogMethod{})
	log.SetLogLevel(ifs.Info_Level)
	res := resources.NewResources(log)

	res.Set(registry.NewRegistry())

	secProvider, _ := sec.LoadSecurityProvider(res)
	if secProvider == nil {
		secProvider = sec.NewShallowSecurityProvider()
	}
	res.Set(secProvider)

	res.SysConfig().LocalAlias = alias
	res.SysConfig().KeepAliveIntervalSeconds = 30

	if logVnet {
		res.SysConfig().VnetPort = res.SysConfig().LogConfig.VnetPort
	}

	if res.SysConfig().LogConfig != nil && res.SysConfig().LogConfig.LogDirectory != "" {
		logger.SetLogToFile(res.SysConfig().LogConfig.LogDirectory, alias)
	}

	res.Set(introspecting.NewIntrospect(res.Registry()))
	res.Set(manager.NewServices(res))

	return res
}

var WaitForSignal = l8c.WaitForSignal
var OpenDBConection = l8c.OpenDBConection

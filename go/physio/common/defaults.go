package common

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8types/go/ifs"
	"os"
	"os/signal"
	"syscall"
)

const (
	PHYSIO_VNET = 49010
	PREFIX      = "/physio/"
)

var DB_CREDS = "admin"
var DB_NAME = "admin"

func CreateResources(alias string) ifs.IResources {
	return l8c.CreateResources(alias, "/data/logs/phy", uint32(PHYSIO_VNET))
}

func WaitForSignal(resources ifs.IResources) {
	resources.Logger().Info("Waiting for os signal...")
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigs
	resources.Logger().Info("End signal received! ", sig)
}

package common

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8types/go/ifs"
)

const (
	PREFIX = "/physio/"
)

var DB_CREDS = "postgres"
var DB_NAME = "admin"

func CreateResources(alias string, logVnet bool) ifs.IResources {
	return l8c.CreateResources(alias, logVnet)
}

var WaitForSignal = l8c.WaitForSignal
var OpenDBConection = l8c.OpenDBConection

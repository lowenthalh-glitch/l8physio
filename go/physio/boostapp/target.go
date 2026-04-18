package boostapp

import (
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8pollaris/go/types/l8tpollaris"
)

// CreateBoostappTarget creates an L8PTarget configured for Boostapp session-based REST collection.
// The credentials (email, password) are passed via AuthInfo.ApiUser and AuthInfo.ApiKey.
// BranchID is embedded in the poll body at runtime.
func CreateBoostappTarget(email, password, branchID string) *l8tpollaris.L8PTarget {
	target := &l8tpollaris.L8PTarget{}
	target.TargetId = "boostapp-" + branchID
	target.LinksId = common.Boostapp_Links_ID
	target.State = l8tpollaris.L8PTargetState_Up

	host := &l8tpollaris.L8PHost{}
	host.HostId = "boostapp-host"
	host.Configs = make(map[int32]*l8tpollaris.L8PHostProtocol)

	restConfig := &l8tpollaris.L8PHostProtocol{}
	restConfig.Protocol = l8tpollaris.L8PProtocol_L8PRESTAPI
	restConfig.Addr = "login.boostapp.co.il"
	restConfig.Port = 443
	restConfig.HttpPrefix = "/office"
	restConfig.Timeout = 60
	restConfig.Ainfo = &l8tpollaris.AuthInfo{
		NeedAuth:      true,
		SessionAuth:   true,
		AuthPath:      "/office/ajax/login/login.php",
		AuthBody:      `{"username":"{{user}}","password":"{{pass}}","action":"loginByEmail"}`,
		AuthUserField: "username",
		AuthPassField: "password",
		AuthResp:      "success",
		ApiUser:       email,
		ApiKey:        password,
		SessionPage:   "/office/",
		CsrfSource:    "/office/calendar.php",
		CsrfPattern:   `csrf-token.*?content="([^"]+)"`,
		PresetCookies: map[string]string{"screen_width": "1657"},
	}
	host.Configs[int32(restConfig.Protocol)] = restConfig

	target.Hosts = make(map[string]*l8tpollaris.L8PHost)
	target.Hosts[host.HostId] = host

	return target
}

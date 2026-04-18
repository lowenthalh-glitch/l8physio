package boostapp

import (
	"github.com/saichler/l8collector/go/collector/common"
	"github.com/saichler/l8pollaris/go/types/l8tpollaris"
)

// Cadence plans for Boostapp polling
var EVERY_15_MINUTES = &l8tpollaris.L8PCadencePlan{Cadences: []int64{900}, Enabled: true}

// CreateBoostappBootPolls creates the Pollaris configuration for Boostapp calendar collection.
// The collector will poll the Boostapp calendar API every 15 minutes.
func CreateBoostappBootPolls() *l8tpollaris.L8Pollaris {
	p := &l8tpollaris.L8Pollaris{}
	p.Name = "boostapp"
	p.Groups = []string{common.BOOT_STAGE_00}
	p.Polling = make(map[string]*l8tpollaris.L8Poll)

	createCalendarPoll(p)

	return p
}

// createCalendarPoll creates the poll for fetching the Boostapp weekly calendar.
// The body contains form-encoded parameters for GetClassesByStudioByDate.
// BranchId, StartDate, and EndDate are substituted at runtime by the sync orchestrator.
func createCalendarPoll(p *l8tpollaris.L8Pollaris) {
	poll := &l8tpollaris.L8Poll{}
	poll.Name = "boostapp-calendar"
	poll.What = "POST::/ajax/CalendarView.php::" +
		"fun=GetClassesByStudioByDate&ClassesAll=1&MeetingsAll=1&Tasks=1&" +
		"Classes=&Meetings=&Locations=&Coaches=&ViewState=timeGridWeek&" +
		"SplitView=0&TypeOfView=1&extraParams=true&showAllCoaches=1&" +
		"showAllLocations=1&blockEvents=1&ScreenWidth=1657&zoomValue=2" +
		"::application/x-www-form-urlencoded; charset=UTF-8"
	poll.Protocol = l8tpollaris.L8PProtocol_L8PRESTAPI
	poll.Cadence = EVERY_15_MINUTES
	poll.Timeout = 60
	poll.Operation = l8tpollaris.L8C_Operation_L8C_Get
	poll.Attributes = make([]*l8tpollaris.L8PAttribute, 0)
	poll.Attributes = append(poll.Attributes, createBoostappParseAttribute())
	p.Polling[poll.Name] = poll
}

// createBoostappParseAttribute creates an attribute that uses the BoostappCalendarParse rule.
func createBoostappParseAttribute() *l8tpollaris.L8PAttribute {
	attr := &l8tpollaris.L8PAttribute{}
	attr.PropertyId = map[string]string{"boostappcalendarevent": "boostappcalendarevent"}
	attr.Rules = make([]*l8tpollaris.L8PRule, 0)
	rule := &l8tpollaris.L8PRule{}
	rule.Name = "BoostappCalendarParse"
	rule.Params = make(map[string]*l8tpollaris.L8PParameter)
	attr.Rules = append(attr.Rules, rule)
	return attr
}

package main

import (
	"os"
	"strconv"
	"time"

	"github.com/saichler/l8bus/go/overlay/vnic"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/physio/boostapp"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/physio/services"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func main() {
	log("=== Boostapp Sync Starting ===")
	res := common.CreateResources("boostapp-sync", false)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()
	log("Connected to vnet")

	services.ActivateAllServices(common.DB_CREDS, common.DB_NAME, nic)
	log("All physio services activated")

	email, password, branchID, err := loadCredentials(res)
	if err != nil {
		log("ERROR: Boostapp credentials not configured: " + err.Error())
		log("Add credentials via System > Security > Credentials (NAME=boostapp, KEY=login)")
		common.WaitForSignal(res)
		return
	}
	log("Credentials loaded (email=" + email + ", branchId=" + branchID + ")")

	client := boostapp.NewClient(email, password, branchID)
	if err := client.Login(); err != nil {
		log("ERROR: Boostapp login failed: " + err.Error())
		common.WaitForSignal(res)
		return
	}
	log("Boostapp login successful")

	if len(os.Args) > 1 && os.Args[1] == "--once" {
		syncOnce(client, nic, res)
		return
	}

	interval := syncInterval()
	log("Sync interval: " + strconv.Itoa(int(interval.Minutes())) + " minutes")
	runSyncLoop(client, nic, res, interval)
}

func log(msg string) {
	println("[boostapp] " + msg)
}

func loadCredentials(res ifs.IResources) (email, password, branchID string, err error) {
	_, email, password, branchID, err = res.Security().Credential("boostapp", "login", res)
	return
}

func syncInterval() time.Duration {
	if v := os.Getenv("BOOSTAPP_SYNC_INTERVAL_MINUTES"); v != "" {
		if m, err := strconv.Atoi(v); err == nil && m > 0 {
			return time.Duration(m) * time.Minute
		}
	}
	return 15 * time.Minute
}

func runSyncLoop(client *boostapp.Client, nic ifs.IVNic, res ifs.IResources, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	syncOnce(client, nic, res)
	for range ticker.C {
		syncOnce(client, nic, res)
	}
}

func syncOnce(client *boostapp.Client, nic ifs.IVNic, res ifs.IResources) {
	start, end := syncDateRange()
	log("--- Sync starting: " + start + " to " + end + " ---")

	resp, err := client.FetchCalendar(start, end)
	if err != nil {
		log("ERROR: Boostapp fetch failed: " + err.Error())
		return
	}

	events := boostapp.ConvertAll(resp)
	log("Fetched " + strconv.Itoa(len(events)) + " events from Boostapp")

	log("Fetching participants for class events...")
	fetchParticipantsForEvents(client, events)

	log("Fetching PhysioClients for linking...")
	clients := fetchPhysioClients(nic, res)
	linked := 0
	if len(clients) > 0 {
		boostapp.LinkClients(events, clients)
		for _, e := range events {
			if e.PhysioClientId != "" {
				linked++
			}
		}
		log("Linked " + strconv.Itoa(linked) + "/" + strconv.Itoa(len(events)) + " events to PhysioClients")
	} else {
		log("No PhysioClients found for linking")
	}

	log("Posting events to BstpCal service...")
	posted, failed := 0, 0
	for _, e := range events {
		_, err := l8c.PostEntity(boostapp.ServiceName, boostapp.ServiceArea, e, nic)
		if err != nil {
			failed++
			log("  FAIL event " + e.EventId + " (" + e.Title + "): " + err.Error())
		} else {
			posted++
		}
	}
	log("--- Sync complete: " + strconv.Itoa(posted) + " posted, " + strconv.Itoa(failed) + " failed, " + strconv.Itoa(len(events)) + " total ---")
}

func syncDateRange() (string, string) {
	now := time.Now()
	weekday := int(now.Weekday())
	sunday := now.AddDate(0, 0, -weekday)
	saturday := sunday.AddDate(0, 0, 6)
	if weekday >= 4 {
		saturday = saturday.AddDate(0, 0, 7)
	}
	return sunday.Format("2006-01-02"), saturday.Format("2006-01-02")
}

func fetchParticipantsForEvents(client *boostapp.Client, events []*physio.BoostappCalendarEvent) {
	for _, e := range events {
		if e.EventType != physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_CLASS {
			continue
		}
		raw, err := client.FetchParticipants(e.EventId)
		if err != nil {
			log("  WARN: failed to fetch participants for event " + e.EventId + ": " + err.Error())
			continue
		}
		e.Participants = boostapp.ConvertParticipants(raw)
	}
}

func fetchPhysioClients(nic ifs.IVNic, res ifs.IResources) []*physio.PhysioClient {
	entities, err := l8c.GetEntities("PhyClient", 50, &physio.PhysioClient{}, nic)
	if err != nil {
		res.Logger().Warning("Could not fetch PhysioClients for linking: " + err.Error())
		return nil
	}
	result := make([]*physio.PhysioClient, 0, len(entities))
	for _, e := range entities {
		if c, ok := e.(*physio.PhysioClient); ok {
			result = append(result, c)
		}
	}
	return result
}

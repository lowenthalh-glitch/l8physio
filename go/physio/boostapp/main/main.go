package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/saichler/l8bus/go/overlay/vnic"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/physio/boostapp"
	"github.com/lowenthalh-glitch/l8physio/go/physio/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func main() {
	log("=== Boostapp Sync Starting ===")
	res := common.CreateResources("boostapp-sync", false)
	ifs.SetNetworkMode(ifs.NETWORK_K8s)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()
	log("Connected to vnet")

	// boostapp_demo activates NOTHING. It is a pure consumer of services owned
	// by physio_demo. Activating any service here (even BstpCal which boostapp
	// "writes") would register this process as a participant in the L8SG service
	// group — and physio_demo's transactional broadcasts (PhyClient POST etc.)
	// would fan out to this node, fail (no handler), and silently drop the row.
	// See ORM_CACHE_CONSISTENCY.md for the full diagnosis.
	//
	// Because we don't activate, we must explicitly register the proto types we
	// send/receive (for serialization) and inspect them (so the local query
	// parser in l8bus/.../SendForward.go createElements can resolve table names
	// in "select * from X" before the request leaves this process).
	for _, t := range []interface{}{
		&physio.PhysioClient{}, &physio.PhysioClientList{},
		&physio.BoostappCalendarEvent{}, &physio.BoostappCalendarEventList{},
	} {
		nic.Resources().Registry().Register(t)
	}
	for _, t := range []interface{}{
		&physio.PhysioClient{},
		&physio.BoostappCalendarEvent{},
	} {
		if _, err := nic.Resources().Introspector().Inspect(t); err != nil {
			log("WARN: failed to inspect type for query parsing: " + err.Error())
		}
	}
	log("Pure consumer mode: no local services activated; PhyClient and BstpCal accessed via vnet")

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
	deleteOldEvents(nic)

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
	boostapp.LinkClients(events, clients)
	if newlyCreated := autoOnboardUnlinked(client, nic, events, clients); newlyCreated > 0 {
		log("Auto-onboarded " + strconv.Itoa(newlyCreated) + " new PhysioClient(s); re-linking...")
		clients = fetchPhysioClients(nic, res)
		boostapp.LinkClients(events, clients)
	}
	if recovered := ensureUsersForClients(nic, clients); recovered > 0 {
		log("Provisioned " + strconv.Itoa(recovered) + " missing system user(s) for existing PhysioClients")
	}
	eventsLinked, partsTotal, partsLinked := 0, 0, 0
	for _, e := range events {
		if e.PhysioClientId != "" {
			eventsLinked++
		}
		for _, p := range e.Participants {
			partsTotal++
			if p.PhysioClientId != "" {
				partsLinked++
			} else {
				log("  UNLINKED participant: event=" + e.EventId + " name=\"" + p.Name + "\" boostapp_client_id=" + p.BoostappClientId)
			}
		}
	}
	log("Linked " + strconv.Itoa(eventsLinked) + "/" + strconv.Itoa(len(events)) + " events, " +
		strconv.Itoa(partsLinked) + "/" + strconv.Itoa(partsTotal) + " participants to PhysioClients (have " + strconv.Itoa(len(clients)) + " PhysioClients)")

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
	end := now.AddDate(0, 0, 14)
	return now.Format("2006-01-02"), end.Format("2006-01-02")
}

func deleteOldEvents(nic ifs.IVNic) {
	today := time.Now().Format("2006-01-02")
	entities, err := l8c.GetEntities(boostapp.ServiceName, boostapp.ServiceArea, &physio.BoostappCalendarEvent{}, nic)
	if err != nil {
		log("WARN: could not fetch events for cleanup: " + err.Error())
		return
	}
	deleted := 0
	for _, e := range entities {
		evt, ok := e.(*physio.BoostappCalendarEvent)
		if !ok || evt.StartTime == "" {
			continue
		}
		if evt.StartTime < today {
			resp := nic.Request("", boostapp.ServiceName, boostapp.ServiceArea, ifs.DELETE, evt, 30)
			if resp.Error() != nil {
				log("  WARN: failed to delete old event " + evt.EventId + ": " + resp.Error().Error())
			} else {
				deleted++
			}
		}
	}
	if deleted > 0 {
		log("Cleaned up " + strconv.Itoa(deleted) + " past events")
	}
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

// autoOnboardUnlinked finds unlinked participants and creates PhysioClient records
// for them, pulling email/phone from Boostapp's getClientsJson endpoint. Returns
// the number of clients newly created.
func autoOnboardUnlinked(bc *boostapp.Client, nic ifs.IVNic, events []*physio.BoostappCalendarEvent, existing []*physio.PhysioClient) int {
	existingBoostappId := make(map[string]bool, len(existing))
	existingEmail := make(map[string]bool, len(existing))
	nextAliasIdx := 1
	for _, c := range existing {
		if c.BoostappId != "" {
			existingBoostappId[c.BoostappId] = true
		}
		if c.Email != "" {
			existingEmail[strings.ToLower(c.Email)] = true
		}
		if strings.HasPrefix(c.Alias, "cli-") {
			if n, err := strconv.Atoi(strings.TrimPrefix(c.Alias, "cli-")); err == nil && n >= nextAliasIdx {
				nextAliasIdx = n + 1
			}
		}
	}

	// Collect unique unlinked (boostapp_client_id, name) pairs from events + participants
	type todo struct{ boostappID, name string }
	seen := make(map[string]bool)
	var queue []todo
	add := func(id, name string) {
		if id == "" || name == "" || existingBoostappId[id] || seen[id] {
			return
		}
		seen[id] = true
		queue = append(queue, todo{id, name})
	}
	for _, e := range events {
		if e.PhysioClientId == "" {
			add(e.BoostappClientId, e.ClientName)
		}
		for _, p := range e.Participants {
			if p.PhysioClientId == "" {
				add(p.BoostappClientId, p.Name)
			}
		}
	}

	created := 0
	for _, t := range queue {
		results, err := bc.FetchClientInfo(t.name)
		if err != nil {
			log("  ONBOARD skip " + t.boostappID + " (" + t.name + "): lookup failed: " + err.Error())
			continue
		}
		var match *boostapp.BoostappClientInfo
		for i := range results {
			if results[i].ID == t.boostappID {
				match = &results[i]
				break
			}
		}
		if match == nil {
			log("  ONBOARD skip " + t.boostappID + " (" + t.name + "): no result with matching id (found " + strconv.Itoa(len(results)) + " result(s))")
			continue
		}
		if match.Email == "" {
			log("  ONBOARD skip " + t.boostappID + " (" + t.name + "): no email in Boostapp")
			continue
		}
		if existingEmail[strings.ToLower(match.Email)] {
			log("  ONBOARD skip " + t.boostappID + " (" + match.Name + "): email " + match.Email + " already used by another PhysioClient")
			continue
		}
		first, last := splitName(match.Name)
		newClient := &physio.PhysioClient{
			ClientId:   match.Email,
			Alias:      fmt.Sprintf("cli-%03d", nextAliasIdx),
			FirstName:  first,
			LastName:   last,
			Email:      match.Email,
			Phone:      match.Phone,
			BoostappId: match.ID,
			Status:     physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE,
		}
		if _, err := l8c.PostEntity("PhyClient", 50, newClient, nic); err != nil {
			log("  ONBOARD FAIL " + t.boostappID + " (" + match.Name + "): " + err.Error())
			continue
		}
		nextAliasIdx++
		existingBoostappId[match.ID] = true
		existingEmail[strings.ToLower(match.Email)] = true
		created++
		log("  ONBOARDED " + match.Name + " (boostapp=" + match.ID + ", email=" + match.Email + ", phone=" + match.Phone + ", clientId=" + newClient.ClientId + ", alias=" + newClient.Alias + ")")

		if err := provisionClientUser(nic, newClient); err != nil {
			log("  USER PROVISION FAIL for " + newClient.Email + ": " + err.Error())
		} else {
			log("  USER PROVISIONED " + newClient.Email + " (userId=" + newClient.ClientId + ", portal=client-app.html, default password)")
		}
	}
	return created
}

func provisionClientUser(nic ifs.IVNic, c *physio.PhysioClient) error {
	userJSON := fmt.Sprintf(`{
		"userId":"%s",
		"fullName":"%s",
		"email":"%s",
		"accountStatus":1,
		"portal":"client-app.html",
		"password":{"hash":"%s"},
		"roles":{"client":true}
	}`, c.ClientId,
		strings.TrimSpace(c.FirstName+" "+c.LastName),
		c.Email,
		defaultClientPassword)

	info, err := nic.Resources().Registry().Info("L8User")
	if err != nil {
		return errors.New("L8User type not registered: " + err.Error())
	}
	user, err := info.NewInstance()
	if err != nil {
		return errors.New("failed to create L8User instance: " + err.Error())
	}
	if err := json.Unmarshal([]byte(userJSON), user); err != nil {
		return errors.New("failed to unmarshal user JSON: " + err.Error())
	}
	_, err = l8c.PostEntity("users", 73, user, nic)
	return err
}

const defaultClientPassword = "12345678"

// ensureUsersForClients provisions a system user (area 73) for every PhysioClient
// that has an email. Attempts POST for each; duplicates are silently ignored.
func ensureUsersForClients(nic ifs.IVNic, clients []*physio.PhysioClient) int {
	recovered := 0
	for _, c := range clients {
		if c.ClientId == "" || c.Email == "" {
			continue
		}
		if err := provisionClientUser(nic, c); err != nil {
			continue
		}
		recovered++
		log("  USER RETRY PROVISIONED " + c.Email + " (userId=" + c.ClientId + ")")
	}
	return recovered
}

// splitName takes "first middle last" and returns ("first", "middle last").
// Single-token names go entirely to FirstName.
func splitName(full string) (string, string) {
	fields := strings.Fields(strings.TrimSpace(full))
	if len(fields) == 0 {
		return "", ""
	}
	if len(fields) == 1 {
		return fields[0], ""
	}
	return fields[0], strings.Join(fields[1:], " ")
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

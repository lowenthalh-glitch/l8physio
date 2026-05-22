package boostapp

import (
	"strings"

	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/types/physio"
)

// LinkClients matches Boostapp events to PhysioClient records.
// Match priority: boostapp_id (stable) > phone > full name.
func LinkClients(events []*physio.BoostappCalendarEvent, clients []*physio.PhysioClient) {
	idMap := make(map[string]string)    // boostapp_id -> clientId
	phoneMap := make(map[string]string) // normalized phone -> clientId
	nameMap := make(map[string]string)  // "firstname lastname" -> clientId

	for _, c := range clients {
		if c.BoostappId != "" {
			idMap[c.BoostappId] = c.ClientId
		}
		if c.Phone != "" {
			phoneMap[common.NormalizePhone(c.Phone)] = c.ClientId
		}
		fullName := strings.TrimSpace(strings.ToLower(c.FirstName + " " + c.LastName))
		if fullName != "" {
			nameMap[fullName] = c.ClientId
		}
	}

	for _, e := range events {
		if e.BoostappClientId != "" {
			if id, ok := idMap[e.BoostappClientId]; ok {
				e.PhysioClientId = id
			}
		}
		if e.PhysioClientId == "" && e.ClientPhone != "" {
			if id, ok := phoneMap[common.NormalizePhone(e.ClientPhone)]; ok {
				e.PhysioClientId = id
			}
		}
		if e.PhysioClientId == "" && e.ClientName != "" {
			if id, ok := nameMap[strings.TrimSpace(strings.ToLower(e.ClientName))]; ok {
				e.PhysioClientId = id
			}
		}
		for _, p := range e.Participants {
			if p.BoostappClientId != "" {
				if id, ok := idMap[p.BoostappClientId]; ok {
					p.PhysioClientId = id
					continue
				}
			}
			if p.Name != "" {
				if id, ok := nameMap[strings.TrimSpace(strings.ToLower(p.Name))]; ok {
					p.PhysioClientId = id
				}
			}
		}
	}
}

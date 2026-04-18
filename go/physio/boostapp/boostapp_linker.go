package boostapp

import (
	"strings"

	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/types/physio"
)

// LinkClients matches Boostapp events to PhysioClient records by phone or name.
func LinkClients(events []*physio.BoostappCalendarEvent, clients []*physio.PhysioClient) {
	phoneMap := make(map[string]string) // normalized phone -> clientId
	nameMap := make(map[string]string)  // "firstname lastname" -> clientId

	for _, c := range clients {
		if c.Phone != "" {
			phoneMap[common.NormalizePhone(c.Phone)] = c.ClientId
		}
		fullName := strings.TrimSpace(strings.ToLower(c.FirstName + " " + c.LastName))
		if fullName != "" {
			nameMap[fullName] = c.ClientId
		}
	}

	for _, e := range events {
		if e.ClientPhone != "" {
			if id, ok := phoneMap[common.NormalizePhone(e.ClientPhone)]; ok {
				e.PhysioClientId = id
			}
		}
		if e.PhysioClientId == "" && e.ClientName != "" {
			if id, ok := nameMap[strings.TrimSpace(strings.ToLower(e.ClientName))]; ok {
				e.PhysioClientId = id
			}
		}
		// Link participants in class events by name
		for _, p := range e.Participants {
			if p.Name == "" {
				continue
			}
			if id, ok := nameMap[strings.TrimSpace(strings.ToLower(p.Name))]; ok {
				p.PhysioClientId = id
			}
		}
	}
}

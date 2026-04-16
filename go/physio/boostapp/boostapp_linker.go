package boostapp

import (
	"strings"

	"github.com/saichler/l8physio/go/types/physio"
)

// LinkClients matches Boostapp events to PhysioClient records by phone or name.
func LinkClients(events []*physio.BoostappCalendarEvent, clients []*physio.PhysioClient) {
	phoneMap := make(map[string]string) // normalized phone -> clientId
	nameMap := make(map[string]string)  // "firstname lastname" -> clientId

	for _, c := range clients {
		if c.Phone != "" {
			phoneMap[normalizePhone(c.Phone)] = c.ClientId
		}
		fullName := strings.TrimSpace(strings.ToLower(c.FirstName + " " + c.LastName))
		if fullName != "" {
			nameMap[fullName] = c.ClientId
		}
	}

	for _, e := range events {
		if e.ClientPhone != "" {
			if id, ok := phoneMap[normalizePhone(e.ClientPhone)]; ok {
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

// normalizePhone strips non-digit characters for matching.
func normalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	s := b.String()
	// Normalize Israeli prefix: +972 → 0
	if strings.HasPrefix(s, "972") && len(s) > 9 {
		s = "0" + s[3:]
	}
	return s
}

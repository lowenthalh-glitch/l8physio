package boostapp

import (
	"fmt"
	"strconv"

	"github.com/saichler/l8physio/go/types/physio"
)

// ConvertEvent transforms a raw Boostapp event into a protobuf BoostappCalendarEvent.
func ConvertEvent(e BoostappEvent) *physio.BoostappCalendarEvent {
	members, _ := strconv.Atoi(e.Members)
	maxMembers, _ := strconv.Atoi(e.MaxMembers)

	out := &physio.BoostappCalendarEvent{
		EventId:         e.ID,
		Title:           e.Title,
		StartTime:       e.Start,
		EndTime:         e.End,
		CoachName:       e.Owner,
		CoachId:         e.OwnerID,
		EventType:       convertEventType(e.Type),
		EventStatus:     convertEventStatus(e.Status),
		Location:        e.Location,
		Members:         int32(members),
		MaxMembers:      int32(maxMembers),
		Price:           e.PriceTotal,
		IsCancelled:     e.IsCancelled,
		BackgroundColor: e.BackgroundColor,
		BranchId:        e.Branch,
	}

	if e.Customer != nil {
		out.ClientName = e.Customer.Name
		out.ClientPhone = e.Customer.Phone
		out.BoostappClientId = e.Customer.ID
	}

	return out
}

// ConvertAll transforms a full Boostapp response into a slice of protobuf events.
func ConvertAll(resp *BoostappCalendarResponse) []*physio.BoostappCalendarEvent {
	result := make([]*physio.BoostappCalendarEvent, 0, len(resp.Classes))
	for _, e := range resp.Classes {
		result = append(result, ConvertEvent(e))
	}
	return result
}

// ConvertParticipants transforms raw participant data into protobuf Participants.
func ConvertParticipants(raw []ParticipantRaw) []*physio.BoostappParticipant {
	result := make([]*physio.BoostappParticipant, 0, len(raw))
	for _, p := range raw {
		result = append(result, &physio.BoostappParticipant{
			ParticipantId:    p.ParticipantID,
			BoostappClientId: p.BoostappClientID,
			Name:             p.Name,
			Status:           p.Status,
			Membership:       p.Membership,
		})
	}
	return result
}

// convertEventType maps Boostapp's mixed type field to the proto enum.
// Boostapp type 1 = meeting, 3 = class, 4 = block.
func convertEventType(raw interface{}) physio.BoostappEventType {
	var t int
	switch v := raw.(type) {
	case float64:
		t = int(v)
	case string:
		t, _ = strconv.Atoi(v)
	default:
		t, _ = strconv.Atoi(fmt.Sprintf("%v", v))
	}
	switch t {
	case 1:
		return physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_MEETING
	case 3:
		return physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_CLASS
	case 4:
		return physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_BLOCK
	default:
		return physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_UNSPECIFIED
	}
}

// convertEventStatus maps Boostapp status string (0-7) to proto enum (shifted +1).
func convertEventStatus(s string) physio.BoostappEventStatus {
	v, _ := strconv.Atoi(s)
	switch v {
	case 0:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_IN_PROCESS
	case 1:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_WAITING_APPROVAL
	case 2:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_BOOKED
	case 3:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_STARTED
	case 4:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_COMPLETED
	case 5:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_NO_SHOW
	case 6:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_DONE
	case 7:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_CANCELLED
	default:
		return physio.BoostappEventStatus_BOOSTAPP_EVENT_STATUS_UNSPECIFIED
	}
}

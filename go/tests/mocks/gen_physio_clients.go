package mocks

import (
	"fmt"
	"math/rand"
	"strings"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// boostappClient holds a real Boostapp participant's data for mock client generation.
type boostappClient struct {
	firstName  string
	lastName   string
	boostappID string
	phone      string // only available for 1-on-1 meeting clients
}

// Real participants from Boostapp calendar sync
var boostappClients = []boostappClient{
	// Class participants
	{"אופיר", "ארדיטי", "430239156", ""},
	{"אורי", "מוקסיי", "431495025", ""},
	{"איה", "עפר ויזל", "431894138", ""},
	{"איזק", "דרור", "431709009", ""},
	{"איילת", "מוקסיי", "431306469", ""},
	{"אילנה", "איליה", "431979812", ""},
	{"אילת", "פלג", "432222748", ""},
	{"איציק", "חן", "431897520", ""},
	{"אירית", "אסף", "432199953", ""},
	{"אלי", "שטוסר", "431209668", ""},
	{"אסתי", "כורם", "431901132", ""},
	{"אריאל", "ויזל", "432052852", ""},
	{"בלה", "פרנס", "431699953", ""},
	{"גילה", "בז׳ה", "430978734", ""},
	{"גלי", "לאור", "432055990", ""},
	{"גריט", "דרור", "431519977", ""},
	{"דורית", "ברקן", "431519974", ""},
	{"דלית", "לבינגר", "431908284", ""},
	{"דנה", "עפר", "431884223", ""},
	{"דנה", "שחר אברהם", "431942352", ""},
	{"הילית", "זיו", "431778330", ""},
	{"חן", "בניזרי", "431792989", ""},
	{"חנאן", "ערפאת", "432254727", ""},
	{"יואב", "בארי", "432263842", ""},
	{"יובל", "דורפן", "430265738", ""},
	{"ליאור", "ארדיטי", "430244836", ""},
	{"לילך", "פאר", "432247015", ""},
	{"מיטל", "דרור", "431579664", ""},
	{"מישאל", "עדן וייס", "431756640", ""},
	{"משה", "בז׳ה", "431086075", ""},
	{"נועם", "נוסבוים", "430284592", ""},
	{"סיגל", "סילגי", "432062293", ""},
	{"עדי", "לבקוביץ", "431016712", ""},
	{"עדי", "סגל", "432120910", ""},
	{"עפרה", "קרפס", "431939973", ""},
	{"פטריסיה", "יערי", "430381384", ""},
	{"רן", "כורם", "430532887", ""},
	{"שולי", "כרמל", "431827390", ""},
	{"שי", "כהן", "431439571", ""},
	{"שיר", "כורם", "431455848", ""},
	{"שרה", "מאיר", "431575613", ""},
	{"תמר", "וישניצר-חביב", "431971633", ""},
	// 1-on-1 meeting clients (have phone numbers)
	{"אילן", "וינקלר", "432230325", "+972548085693"},
	{"אלון", "גושה", "432062872", "+972587890098"},
	{"הילה", "כהן", "432270434", "+972528537208"},
	{"חן", "אלמה", "431606103", "+972503411181"},
	{"יוסי", "דרור", "431634231", "+972544660108"},
	{"תום", "חנן", "431554247", "+972534260899"},
}

// generatePhysioClients creates PhysioClient records from real Boostapp participants.
func generatePhysioClients() []*physio.PhysioClient {
	clients := make([]*physio.PhysioClient, len(boostappClients))

	for i, bc := range boostappClients {
		emailFirst := transliterate(bc.firstName)
		emailLast := transliterate(strings.Split(bc.lastName, " ")[0])
		email := fmt.Sprintf("%s.%s@physio-clinic.co.il", emailFirst, emailLast)

		phone := bc.phone
		if phone == "" {
			phone = fmt.Sprintf("+9725%d", 20000000+rand.Intn(9999999))
		}

		// Status: 90% Active, 10% Inactive
		var status physio.PhysioClientStatus
		if i < len(boostappClients)*9/10 {
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE
		} else {
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_INACTIVE
		}

		clients[i] = &physio.PhysioClient{
			ClientId:         lm.GenID("cli", i),
			FirstName:        bc.firstName,
			LastName:         bc.lastName,
			Email:            email,
			Phone:            phone,
			BoostappId:       bc.boostappID,
			DateOfBirth:      lm.RandomBirthDate(),
			Status:           status,
			ReferralSource:   referralSources[i%len(referralSources)],
			Diagnosis:        diagnoses[i%len(diagnoses)],
			MedicalHistory:   fmt.Sprintf("Presenting with %s.", diagnoses[i%len(diagnoses)]),
			EmergencyContact: fmt.Sprintf("%s %s - +9725%d", bc.firstName, bc.lastName, 30000000+rand.Intn(9999999)),
			AuditInfo:        lm.CreateAuditInfo(),
		}
	}

	return clients
}

// assignClientProtocols updates clients with protocol and therapist IDs once available.
func assignClientProtocols(clients []*physio.PhysioClient, store *MockDataStore) []*physio.PhysioClient {
	if len(store.PhysioProtocolIDs) > 0 {
		for i, c := range clients {
			c.ProtocolId = store.PhysioProtocolIDs[i%len(store.PhysioProtocolIDs)]
		}
	}
	if len(store.PhysioTherapistIDs) > 0 {
		for i, c := range clients {
			c.TherapistId = store.PhysioTherapistIDs[i%len(store.PhysioTherapistIDs)]
		}
	}
	return clients
}

// transliterate converts Hebrew characters to Latin for email generation.
func transliterate(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case 'א':
			b.WriteRune('a')
		case 'ב':
			b.WriteRune('b')
		case 'ג':
			b.WriteRune('g')
		case 'ד':
			b.WriteRune('d')
		case 'ה':
			b.WriteRune('h')
		case 'ו':
			b.WriteRune('v')
		case 'ז':
			b.WriteRune('z')
		case 'ח':
			b.WriteString("ch")
		case 'ט':
			b.WriteRune('t')
		case 'י':
			b.WriteRune('y')
		case 'כ', 'ך':
			b.WriteRune('k')
		case 'ל':
			b.WriteRune('l')
		case 'מ', 'ם':
			b.WriteRune('m')
		case 'נ', 'ן':
			b.WriteRune('n')
		case 'ס':
			b.WriteRune('s')
		case 'ע':
			b.WriteRune('a')
		case 'פ', 'ף':
			b.WriteRune('p')
		case 'צ', 'ץ':
			b.WriteString("tz")
		case 'ק':
			b.WriteRune('k')
		case 'ר':
			b.WriteRune('r')
		case 'ש':
			b.WriteString("sh")
		case 'ת':
			b.WriteRune('t')
		case '׳':
			// geresh - skip
		case '-':
			b.WriteRune('-')
		}
	}
	return b.String()
}

package common

import (
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/aes"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/nets"
	"github.com/saichler/l8types/go/sec"
	"github.com/saichler/l8types/go/types/l8sysconfig"
)

const (
	RoleAdmin     = "admin"
	RoleTherapist = "therapist"
	RoleClient    = "client"
)

type userInfo struct {
	email    string
	role     string
	entityId string // clientId or therapistId
}

// PhysioSecurityProvider wraps ShallowSecurityProvider with user tracking and role-based filtering.
type PhysioSecurityProvider struct {
	shallow *sec.ShallowSecurityProvider
	secret  string
	key     string

	mu       sync.RWMutex
	creds    map[string]string    // email → password
	tokens   map[string]string    // token → email
	users    map[string]*userInfo // email → role info (cached)
	tokenSeq int
}

func NewPhysioSecurityProvider() *PhysioSecurityProvider {
	hash := md5.New()
	s := "Shallow Security Provider"
	hash.Write([]byte(s))
	kHash := hash.Sum(nil)
	return &PhysioSecurityProvider{
		shallow:  sec.NewShallowSecurityProvider(),
		secret:   s,
		key:      base64.StdEncoding.EncodeToString(kHash),
		creds:    make(map[string]string),
		tokens:   make(map[string]string),
		users:    make(map[string]*userInfo),
		tokenSeq: 0,
	}
}

// Register stores credentials in memory.
func (p *PhysioSecurityProvider) Register(email, password, captcha string, vnic ifs.IVNic) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.creds[email] = password
	return nil
}

// Authenticate validates creds and returns a unique token.
func (p *PhysioSecurityProvider) Authenticate(user, pass string, vnic ifs.IVNic) (string, string, bool, bool, string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Admin always works
	if user == "admin" && pass == "admin" {
		p.tokenSeq++
		token := fmt.Sprintf("token-%d-admin", p.tokenSeq)
		p.tokens[token] = "admin"
		return token, "", false, false, "", nil
	}

	stored, ok := p.creds[user]
	if !ok || stored != pass {
		return "", "", false, false, "", fmt.Errorf("invalid credentials")
	}
	p.tokenSeq++
	token := fmt.Sprintf("token-%d-%s", p.tokenSeq, user)
	p.tokens[token] = user
	return token, "", false, false, "", nil
}

// ValidateToken returns the stored username for this token.
func (p *PhysioSecurityProvider) ValidateToken(token string, vnic ifs.IVNic) (string, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	email, ok := p.tokens[token]
	if !ok {
		return "admin", true // fallback for system calls
	}
	return email, true
}

func (p *PhysioSecurityProvider) resolveRole(email string) string {
	if email == "admin" {
		return RoleAdmin
	}
	if strings.Contains(email, "@clinic.example.com") {
		return RoleTherapist
	}
	return RoleClient
}

// getUserInfo returns cached user info, building it lazily from ScopeView data.
func (p *PhysioSecurityProvider) getUserInfo(email string) *userInfo {
	p.mu.RLock()
	info, ok := p.users[email]
	p.mu.RUnlock()
	if ok {
		return info
	}
	// Create basic info from email pattern; entityId filled in by ScopeView
	info = &userInfo{email: email, role: p.resolveRole(email)}
	p.mu.Lock()
	p.users[email] = info
	p.mu.Unlock()
	return info
}

func (p *PhysioSecurityProvider) cacheEntityId(email, entityId string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if u, ok := p.users[email]; ok && u.entityId == "" {
		u.entityId = entityId
	}
}

// CanDoAction restricts client write operations.
func (p *PhysioSecurityProvider) CanDoAction(vnic ifs.IVNic, action ifs.Action, o ifs.IElements, uuid string, token string, salts ...string) error {
	// System/internal calls and unknown tokens pass through
	if token == "" || !strings.Contains(token, "@") {
		return nil
	}
	role := p.resolveRole(token)
	if role == RoleAdmin || role == RoleTherapist {
		return nil
	}
	// Clients: allow GET always, allow PUT on ProgressLog
	if action == ifs.GET {
		return nil
	}
	if action == ifs.PUT && o != nil {
		elem := o.Element()
		if elem != nil {
			if _, ok := elem.(*physio.ProgressLog); ok {
				return nil
			}
		}
	}
	if action == ifs.POST || action == ifs.PUT || action == ifs.DELETE {
		return fmt.Errorf("clients cannot modify this resource")
	}
	return nil
}

// ScopeView filters response data based on user role.
func (p *PhysioSecurityProvider) ScopeView(vnic ifs.IVNic, o ifs.IElements, uuid string, token string, salts ...string) ifs.IElements {
	if o == nil {
		return o
	}
	// System/internal calls pass through unfiltered
	if token == "" || !strings.Contains(token, "@") {
		return o
	}
	info := p.getUserInfo(token)
	if info.role == RoleAdmin {
		return o
	}
	elems := o.Elements()
	if len(elems) == 0 {
		return o
	}

	// Discover entity type from first element and build mapping
	first := elems[0]
	if first == nil {
		return o
	}

	switch first.(type) {
	case *physio.PhysioClient:
		return p.filterClients(elems, info)
	case *physio.TreatmentPlan:
		return p.filterPlans(elems, info)
	case *physio.Appointment:
		return p.filterAppointments(elems, info)
	case *physio.ProgressLog:
		return p.filterProgressLogs(elems, info)
	case *physio.PhysioTherapist:
		p.cacheTherapistId(elems, info)
		return o
	}
	return o
}

func (p *PhysioSecurityProvider) filterClients(elems []interface{}, info *userInfo) ifs.IElements {
	var filtered []interface{}
	for _, e := range elems {
		c, ok := e.(*physio.PhysioClient)
		if !ok || c == nil {
			continue
		}
		// Cache mapping for this client
		if c.Email != "" {
			p.cacheEntityId(c.Email, c.ClientId)
		}
		if info.role == RoleClient {
			if c.Email == info.email {
				info.entityId = c.ClientId
				filtered = append(filtered, e)
			}
		} else if info.role == RoleTherapist {
			if info.entityId != "" && c.TherapistId == info.entityId {
				filtered = append(filtered, e)
			} else if info.entityId == "" {
				filtered = append(filtered, e) // therapistId not cached yet
			}
		}
	}
	if filtered == nil {
		filtered = []interface{}{}
	}
	return object.New(nil, filtered)
}

func (p *PhysioSecurityProvider) filterPlans(elems []interface{}, info *userInfo) ifs.IElements {
	allowedClients := p.allowedClientIds(info)
	if allowedClients == nil {
		return object.New(nil, elems) // no filter if mapping not ready
	}
	var filtered []interface{}
	for _, e := range elems {
		plan, ok := e.(*physio.TreatmentPlan)
		if !ok || plan == nil {
			continue
		}
		if allowedClients[plan.ClientId] {
			filtered = append(filtered, e)
		}
	}
	if filtered == nil {
		filtered = []interface{}{}
	}
	return object.New(nil, filtered)
}

func (p *PhysioSecurityProvider) filterAppointments(elems []interface{}, info *userInfo) ifs.IElements {
	allowedClients := p.allowedClientIds(info)
	if allowedClients == nil {
		return object.New(nil, elems)
	}
	var filtered []interface{}
	for _, e := range elems {
		appt, ok := e.(*physio.Appointment)
		if !ok || appt == nil {
			continue
		}
		if allowedClients[appt.ClientId] {
			filtered = append(filtered, e)
		}
	}
	if filtered == nil {
		filtered = []interface{}{}
	}
	return object.New(nil, filtered)
}

func (p *PhysioSecurityProvider) filterProgressLogs(elems []interface{}, info *userInfo) ifs.IElements {
	allowedClients := p.allowedClientIds(info)
	if allowedClients == nil {
		return object.New(nil, elems)
	}
	var filtered []interface{}
	for _, e := range elems {
		log, ok := e.(*physio.ProgressLog)
		if !ok || log == nil {
			continue
		}
		if allowedClients[log.ClientId] {
			filtered = append(filtered, e)
		}
	}
	if filtered == nil {
		filtered = []interface{}{}
	}
	return object.New(nil, filtered)
}

func (p *PhysioSecurityProvider) cacheTherapistId(elems []interface{}, info *userInfo) {
	if info.role != RoleTherapist {
		return
	}
	for _, e := range elems {
		t, ok := e.(*physio.PhysioTherapist)
		if !ok || t == nil {
			continue
		}
		if t.Email == info.email {
			info.entityId = t.TherapistId
			p.cacheEntityId(info.email, t.TherapistId)
			break
		}
	}
}

// allowedClientIds returns the set of clientIds this user may see.
func (p *PhysioSecurityProvider) allowedClientIds(info *userInfo) map[string]bool {
	if info.role == RoleClient && info.entityId != "" {
		return map[string]bool{info.entityId: true}
	}
	if info.role == RoleTherapist {
		// Build from cached clients
		p.mu.RLock()
		defer p.mu.RUnlock()
		result := make(map[string]bool)
		for _, u := range p.users {
			if u.role == RoleClient && u.entityId != "" {
				result[u.entityId] = true
			}
		}
		if len(result) > 0 {
			return result
		}
		return nil // mapping not ready yet
	}
	return nil
}

// Delegate all other methods to ShallowSecurityProvider
func (p *PhysioSecurityProvider) CanDial(h string, port uint32) (net.Conn, error) {
	return p.shallow.CanDial(h, port)
}
func (p *PhysioSecurityProvider) CanAccept(c net.Conn) error { return p.shallow.CanAccept(c) }
func (p *PhysioSecurityProvider) ValidateConnection(c net.Conn, cfg *l8sysconfig.L8SysConfig) error {
	err := nets.WriteEncrypted(c, []byte(p.secret), cfg, p)
	if err != nil {
		c.Close()
		return err
	}
	secret, err := nets.ReadEncrypted(c, cfg, p)
	if err != nil {
		c.Close()
		return err
	}
	if p.secret != secret {
		c.Close()
		return fmt.Errorf("incorrect Secret/Key, aborting connection")
	}
	return nets.ExecuteProtocol(c, cfg, p)
}
func (p *PhysioSecurityProvider) Encrypt(data []byte) (string, error) {
	return aes.Encrypt(data, p.key)
}
func (p *PhysioSecurityProvider) Decrypt(data string) ([]byte, error) {
	return aes.Decrypt(data, p.key)
}
func (p *PhysioSecurityProvider) Message(aaaid string, vnic ifs.IVNic) (*ifs.Message, error) {
	return &ifs.Message{}, nil
}
func (p *PhysioSecurityProvider) TFASetup(uid string, vnic ifs.IVNic) (string, []byte, error) {
	return "", nil, nil
}
func (p *PhysioSecurityProvider) TFAVerify(uid, code, bearer string, vnic ifs.IVNic) error {
	return nil
}
func (p *PhysioSecurityProvider) Captcha() []byte { return nil }
func (p *PhysioSecurityProvider) Credential(crId, cId string, r ifs.IResources) (string, string, string, string, error) {
	return "admin", "admin", "admin", "5432", nil
}
func (p *PhysioSecurityProvider) AllowedTypes(vnic ifs.IVNic, token string) []string { return nil }
func (p *PhysioSecurityProvider) AllowedActions(vnic ifs.IVNic, token string) map[string][]int32 {
	return nil
}

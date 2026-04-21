package common

const (
	Boostapp_Links_ID             = "Bstp"
	Boostapp_Collector_Service_Name = "BColl"
	Boostapp_Collector_Service_Area = byte(50)
	Boostapp_Parser_Service_Name  = "BPars"
	Boostapp_Parser_Service_Area  = byte(50)
	Boostapp_Cache_Service_Name   = "BCache"
	Boostapp_Cache_Service_Area   = byte(50)
	Boostapp_Persist_Service_Name = "BPersist"
	Boostapp_Persist_Service_Area = byte(50)
	Boostapp_Model_Name           = "boostappcalendarevent"
)

type BoostappLinks struct{}

func (this *BoostappLinks) Collector(linkid string) (string, byte) {
	return Boostapp_Collector_Service_Name, Boostapp_Collector_Service_Area
}

func (this *BoostappLinks) Parser(linkid string) (string, byte) {
	if linkid == Boostapp_Links_ID {
		return Boostapp_Parser_Service_Name, Boostapp_Parser_Service_Area
	}
	return "", 0
}

func (this *BoostappLinks) Cache(linkid string) (string, byte) {
	if linkid == Boostapp_Links_ID {
		return Boostapp_Cache_Service_Name, Boostapp_Cache_Service_Area
	}
	return "", 0
}

func (this *BoostappLinks) Persist(linkid string) (string, byte) {
	if linkid == Boostapp_Links_ID {
		return Boostapp_Persist_Service_Name, Boostapp_Persist_Service_Area
	}
	return "", 0
}

func (this *BoostappLinks) Model(linkid string) string {
	if linkid == Boostapp_Links_ID {
		return Boostapp_Model_Name
	}
	return ""
}

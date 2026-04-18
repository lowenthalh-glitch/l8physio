package boostapp

import (
	"encoding/json"
	"errors"

	"github.com/saichler/l8pollaris/go/types/l8tpollaris"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/ifs"
)

// BoostappCalendarRule is a parsing rule that converts raw Boostapp calendar JSON
// (from a CJob result) into BoostappCalendarEvent protobuf objects.
// It implements the rules.ParsingRule interface from l8parser and is registered
// at runtime via service.RegisterRule to avoid circular imports.
type BoostappCalendarRule struct{}

func (this *BoostappCalendarRule) Name() string {
	return "BoostappCalendarParse"
}

func (this *BoostappCalendarRule) ParamNames() []string {
	return []string{""}
}

// Parse deserializes the CJob JSON into a BoostappCalendarResponse, converts each
// event to a protobuf BoostappCalendarEvent, and stores the result list in the workspace
// under the "Output" key.
func (this *BoostappCalendarRule) Parse(resources ifs.IResources, workSpace map[string]interface{},
	params map[string]*l8tpollaris.L8PParameter, any interface{}, pollWhat string) error {

	input := workSpace["Input"]
	if input == nil {
		return nil
	}

	// Extract JSON string from CMap (key "json") sent by RestCollector
	var jsonStr string
	if cmap, ok := input.(*l8tpollaris.CMap); ok {
		jsonBytes, exists := cmap.Data["json"]
		if !exists || len(jsonBytes) == 0 {
			return errors.New("BoostappCalendarParse: CMap has no 'json' key")
		}
		dec := object.NewDecode(jsonBytes, 0, resources.Registry())
		val, err := dec.Get()
		if err != nil {
			return errors.New("BoostappCalendarParse: failed to decode json from CMap: " + err.Error())
		}
		jsonStr, _ = val.(string)
	} else if s, ok := input.(string); ok {
		jsonStr = s
	} else {
		return errors.New("BoostappCalendarParse: unsupported input type")
	}

	var resp BoostappCalendarResponse
	if err := json.Unmarshal([]byte(jsonStr), &resp); err != nil {
		return errors.New("BoostappCalendarParse: JSON parse failed: " + err.Error())
	}

	if resp.Status != "Success" {
		return errors.New("BoostappCalendarParse: Boostapp returned status: " + resp.Status)
	}

	events := ConvertAll(&resp)
	workSpace["Output"] = events
	return nil
}

package aia

import (
	agent "github.com/saichler/l8agent/go"
	"github.com/saichler/l8agent/go/types/l8agent"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceArea = byte(55)
)

func agentConfig(creds, dbname string, vnic ifs.IVNic) agent.AgentConfig {
	return agent.AgentConfig{
		Resources:   vnic.Resources(),
		ServiceArea: ServiceArea,
		DBCreds:     creds,
		DBName:      dbname,
		LLMCreds:    "Anthropic",
		DefaultPrompts: []*l8agent.L8AgentPrompt{
			{
				Name:        "Physiotherapist Assistant",
				Description: "Helps physiotherapists review client progress and treatment plans",
				SystemPrompt: "You are a physiotherapy clinical assistant. You help therapists review client " +
					"treatment plans, exercise prescriptions, and progress logs. Focus on adherence, " +
					"pain trends, and exercise completion rates. Use aggregate queries to identify " +
					"patterns across clients. Always maintain patient confidentiality.",
				Category: int32(l8agent.L8AgentPromptCategory_L8_AGENT_PROMPT_CATEGORY_WORKFLOW),
			},
			{
				Name:        "Client Progress Analyzer",
				Description: "Analyzes progress logs and identifies trends in recovery",
				SystemPrompt: "You are a physiotherapy progress analyst. Analyze session logs to identify " +
					"pain level trends, exercise completion rates, and recovery trajectories. " +
					"Use aggregate queries to compute averages and trends over time. " +
					"Highlight clients who may need plan adjustments based on their progress data.",
				Category: int32(l8agent.L8AgentPromptCategory_L8_AGENT_PROMPT_CATEGORY_ANALYSIS),
			},
			{
				Name:        "Appointment Scheduler",
				Description: "Helps manage and review appointment schedules",
				SystemPrompt: "You are a physiotherapy scheduling assistant. Help review appointment " +
					"schedules, identify gaps, and summarize upcoming sessions. Use aggregate queries " +
					"to provide scheduling insights without exposing individual patient details unnecessarily.",
				Category: int32(l8agent.L8AgentPromptCategory_L8_AGENT_PROMPT_CATEGORY_REPORTING),
			},
		},
	}
}

// Activate activates the AI agent ORM services (conversations, messages, prompts).
// Call this during parallel service activation.
func Activate(creds, dbname string, vnic ifs.IVNic) {
	config := agentConfig(creds, dbname, vnic)
	agent.Initialize(config, vnic)
}

// ActivateChat activates the AI agent chat orchestration service.
// Must be called after all other services are activated so the introspector is fully populated.
func ActivateChat(creds, dbname string, vnic ifs.IVNic) {
	config := agentConfig(creds, dbname, vnic)
	agent.InitializeChat(config, vnic)
}

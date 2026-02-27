package linear

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Manager manages Linear API interactions.
type Manager struct {
	ctx        context.Context
	mu         sync.RWMutex
	apiKey     string
	oauthToken string
	httpClient *http.Client
	pollStop   chan struct{}
	polling    bool
	oauth      *oauthState
}

// NewManager creates a new Linear manager.
func NewManager() *Manager {
	return &Manager{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetContext sets the Wails runtime context.
func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

// SetAPIKey validates and sets the Linear API key. Returns the authenticated user.
func (m *Manager) SetAPIKey(key string) (*Me, error) {
	me, err := m.ValidateAPIKey(key)
	if err != nil {
		return nil, err
	}
	return me, nil
}

// GetMe returns the authenticated user.
func (m *Manager) GetMe() (*Me, error) {
	data, err := m.doQuery(queryViewer, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Viewer Me `json:"viewer"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parse viewer: %w", err)
	}
	return &result.Viewer, nil
}

// ListTeams returns all teams the user belongs to.
func (m *Manager) ListTeams() ([]Team, error) {
	data, err := m.doQuery(queryTeams, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Teams struct {
			Nodes []Team `json:"nodes"`
		} `json:"teams"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parse teams: %w", err)
	}
	return result.Teams.Nodes, nil
}

// GetCycleIssues returns issues in the active cycle for a team, along with all team states.
func (m *Manager) GetCycleIssues(teamID string) (*CycleIssuesResponse, error) {
	vars := map[string]interface{}{"teamId": teamID}

	// Fetch active cycle issues
	data, err := m.doQuery(queryActiveCycle, vars)
	if err != nil {
		return nil, err
	}

	var cycleResult struct {
		Team struct {
			ActiveCycle *struct {
				ID       string `json:"id"`
				Name     string `json:"name"`
				Number   int    `json:"number"`
				StartsAt string `json:"startsAt"`
				EndsAt   string `json:"endsAt"`
				Issues   struct {
					Nodes []json.RawMessage `json:"nodes"`
				} `json:"issues"`
			} `json:"activeCycle"`
		} `json:"team"`
	}
	if err := json.Unmarshal(data, &cycleResult); err != nil {
		return nil, fmt.Errorf("parse cycle: %w", err)
	}

	if cycleResult.Team.ActiveCycle == nil {
		return &CycleIssuesResponse{}, nil
	}

	ac := cycleResult.Team.ActiveCycle
	cycle := &Cycle{
		ID:       ac.ID,
		Name:     ac.Name,
		Number:   ac.Number,
		StartsAt: ac.StartsAt,
		EndsAt:   ac.EndsAt,
	}

	issues := make([]Issue, 0, len(ac.Issues.Nodes))
	for _, raw := range ac.Issues.Nodes {
		var issue issueRaw
		if err := json.Unmarshal(raw, &issue); err != nil {
			continue
		}
		labels := make([]Label, len(issue.Labels.Nodes))
		copy(labels, issue.Labels.Nodes)
		issues = append(issues, Issue{
			ID:          issue.ID,
			Identifier:  issue.Identifier,
			Title:       issue.Title,
			Description: issue.Description,
			Priority:    issue.Priority,
			State:       issue.State,
			Assignee:    issue.Assignee,
			Labels:      labels,
			Team:        issue.Team,
			URL:         issue.URL,
			CreatedAt:   issue.CreatedAt,
			UpdatedAt:   issue.UpdatedAt,
		})
	}

	// Fetch team states
	statesData, err := m.doQuery(queryTeamStates, vars)
	if err != nil {
		return &CycleIssuesResponse{Cycle: cycle, Issues: issues}, nil
	}

	var statesResult struct {
		Team struct {
			States struct {
				Nodes []State `json:"nodes"`
			} `json:"states"`
		} `json:"team"`
	}
	if err := json.Unmarshal(statesData, &statesResult); err != nil {
		return &CycleIssuesResponse{Cycle: cycle, Issues: issues}, nil
	}

	return &CycleIssuesResponse{
		Cycle:  cycle,
		Issues: issues,
		States: statesResult.Team.States.Nodes,
	}, nil
}

type issueRaw struct {
	ID          string `json:"id"`
	Identifier  string `json:"identifier"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    int    `json:"priority"`
	State       State  `json:"state"`
	Assignee    *User  `json:"assignee"`
	Labels      struct {
		Nodes []Label `json:"nodes"`
	} `json:"labels"`
	Team      *Team  `json:"team"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// GetMyIssues returns all issues assigned to the authenticated user.
func (m *Manager) GetMyIssues() (*CycleIssuesResponse, error) {
	data, err := m.doQuery(queryMyIssues, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Viewer struct {
			AssignedIssues struct {
				Nodes []json.RawMessage `json:"nodes"`
			} `json:"assignedIssues"`
		} `json:"viewer"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parse my issues: %w", err)
	}

	issues := make([]Issue, 0, len(result.Viewer.AssignedIssues.Nodes))
	stateMap := make(map[string]State)
	for _, raw := range result.Viewer.AssignedIssues.Nodes {
		var issue issueRaw
		if err := json.Unmarshal(raw, &issue); err != nil {
			continue
		}
		labels := make([]Label, len(issue.Labels.Nodes))
		copy(labels, issue.Labels.Nodes)
		issues = append(issues, Issue{
			ID:          issue.ID,
			Identifier:  issue.Identifier,
			Title:       issue.Title,
			Description: issue.Description,
			Priority:    issue.Priority,
			State:       issue.State,
			Assignee:    issue.Assignee,
			Labels:      labels,
			Team:        issue.Team,
			URL:         issue.URL,
			CreatedAt:   issue.CreatedAt,
			UpdatedAt:   issue.UpdatedAt,
		})
		stateMap[issue.State.ID] = issue.State
	}

	states := make([]State, 0, len(stateMap))
	for _, s := range stateMap {
		states = append(states, s)
	}

	return &CycleIssuesResponse{
		Cycle:  nil,
		Issues: issues,
		States: states,
	}, nil
}

// GetIssue returns a single issue by ID.
func (m *Manager) GetIssue(issueID string) (*Issue, error) {
	data, err := m.doQuery(queryIssue, map[string]interface{}{"id": issueID})
	if err != nil {
		return nil, err
	}

	var result struct {
		Issue issueRaw `json:"issue"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("parse issue: %w", err)
	}

	labels := make([]Label, len(result.Issue.Labels.Nodes))
	copy(labels, result.Issue.Labels.Nodes)
	issue := &Issue{
		ID:          result.Issue.ID,
		Identifier:  result.Issue.Identifier,
		Title:       result.Issue.Title,
		Description: result.Issue.Description,
		Priority:    result.Issue.Priority,
		State:       result.Issue.State,
		Assignee:    result.Issue.Assignee,
		Labels:      labels,
		Team:        result.Issue.Team,
		URL:         result.Issue.URL,
		CreatedAt:   result.Issue.CreatedAt,
		UpdatedAt:   result.Issue.UpdatedAt,
	}
	return issue, nil
}

// UpdateIssueState changes the state of an issue.
func (m *Manager) UpdateIssueState(issueID, stateID string) error {
	_, err := m.doQuery(mutationUpdateIssueState, map[string]interface{}{
		"id":      issueID,
		"stateId": stateID,
	})
	return err
}

// StartPolling begins polling the active cycle for changes.
func (m *Manager) StartPolling(teamID string, intervalSec int) {
	m.mu.Lock()
	if m.polling {
		m.mu.Unlock()
		return
	}
	m.pollStop = make(chan struct{})
	m.polling = true
	m.mu.Unlock()

	if intervalSec < 10 {
		intervalSec = 10
	}

	go func() {
		ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				resp, err := m.GetCycleIssues(teamID)
				if err != nil {
					continue
				}
				runtime.EventsEmit(m.ctx, "linear:issues:updated", resp)
			case <-m.pollStop:
				return
			}
		}
	}()
}

// StartMyIssuesPolling begins polling the user's assigned issues for changes.
func (m *Manager) StartMyIssuesPolling(intervalSec int) {
	m.mu.Lock()
	if m.polling {
		m.mu.Unlock()
		return
	}
	m.pollStop = make(chan struct{})
	m.polling = true
	m.mu.Unlock()

	if intervalSec < 10 {
		intervalSec = 10
	}

	go func() {
		ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				resp, err := m.GetMyIssues()
				if err != nil {
					continue
				}
				runtime.EventsEmit(m.ctx, "linear:issues:updated", resp)
			case <-m.pollStop:
				return
			}
		}
	}()
}

// StopPolling stops the active polling goroutine.
func (m *Manager) StopPolling() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.polling {
		close(m.pollStop)
		m.polling = false
	}
}

// IsConnected returns true if any authentication is configured.
func (m *Manager) IsConnected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.apiKey != "" || m.oauthToken != ""
}

// LoadAPIKey sets the API key without validation (used on startup from settings).
func (m *Manager) LoadAPIKey(key string) {
	m.mu.Lock()
	m.apiKey = key
	m.mu.Unlock()
}

// LoadOAuthToken sets the OAuth token without validation (used on startup from settings).
func (m *Manager) LoadOAuthToken(token string) {
	m.mu.Lock()
	m.oauthToken = token
	m.mu.Unlock()
}

package linear

// Team represents a Linear team.
type Team struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

// Cycle represents a Linear cycle (sprint).
type Cycle struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Number   int    `json:"number"`
	StartsAt string `json:"startsAt"`
	EndsAt   string `json:"endsAt"`
}

// Issue represents a Linear issue.
type Issue struct {
	ID          string  `json:"id"`
	Identifier  string  `json:"identifier"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    int     `json:"priority"`
	State       State   `json:"state"`
	Assignee    *User   `json:"assignee"`
	Labels      []Label `json:"labels"`
	Team        *Team   `json:"team"`
	URL         string  `json:"url"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

// State represents a Linear workflow state.
type State struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Type  string `json:"type"` // triage, backlog, unstarted, started, completed, canceled
}

// User represents a Linear user.
type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Label represents a Linear label.
type Label struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

// Me represents the authenticated user.
type Me struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// CycleIssuesResponse is the parsed response for active cycle issues.
type CycleIssuesResponse struct {
	Cycle  *Cycle  `json:"cycle"`
	Issues []Issue `json:"issues"`
	States []State `json:"states"`
}

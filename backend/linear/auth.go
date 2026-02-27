package linear

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const linearEndpoint = "https://api.linear.app/graphql"

type graphqlRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

type graphqlResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (m *Manager) doQuery(query string, variables map[string]interface{}) (json.RawMessage, error) {
	m.mu.RLock()
	apiKey := m.apiKey
	oauthToken := m.oauthToken
	m.mu.RUnlock()

	if oauthToken == "" && apiKey == "" {
		return nil, fmt.Errorf("not authenticated with Linear")
	}

	reqBody, err := json.Marshal(graphqlRequest{
		Query:     query,
		Variables: variables,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", linearEndpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if oauthToken != "" {
		req.Header.Set("Authorization", "Bearer "+oauthToken)
	} else {
		req.Header.Set("Authorization", apiKey)
	}

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("linear API returned %d: %s", resp.StatusCode, string(body))
	}

	var gqlResp graphqlResponse
	if err := json.Unmarshal(body, &gqlResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		return nil, fmt.Errorf("linear API error: %s", gqlResp.Errors[0].Message)
	}

	return gqlResp.Data, nil
}

// ValidateAPIKey tests the API key by querying the viewer endpoint.
func (m *Manager) ValidateAPIKey(key string) (*Me, error) {
	m.mu.Lock()
	oldKey := m.apiKey
	m.apiKey = key
	m.mu.Unlock()

	data, err := m.doQuery(queryViewer, nil)
	if err != nil {
		m.mu.Lock()
		m.apiKey = oldKey
		m.mu.Unlock()
		return nil, fmt.Errorf("invalid API key: %w", err)
	}

	var result struct {
		Viewer Me `json:"viewer"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		m.mu.Lock()
		m.apiKey = oldKey
		m.mu.Unlock()
		return nil, fmt.Errorf("parse viewer response: %w", err)
	}

	return &result.Viewer, nil
}

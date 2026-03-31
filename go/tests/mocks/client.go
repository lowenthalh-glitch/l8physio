package mocks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// PhysioClient handles API communication with the Physio server
type PhysioClient struct {
	baseURL string
	token   string
	client  *http.Client
}

// NewPhysioClient creates a new PhysioClient with the given base URL and HTTP client
func NewPhysioClient(baseURL string, httpClient *http.Client) *PhysioClient {
	return &PhysioClient{baseURL: baseURL, client: httpClient}
}

func (c *PhysioClient) Authenticate(user, password string) error {
	authData := map[string]string{
		"user": user,
		"pass": password,
	}
	body, _ := json.Marshal(authData)

	resp, err := c.client.Post(c.baseURL+"/auth", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("auth failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var authResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("failed to decode auth response: %w", err)
	}

	token, ok := authResp["token"].(string)
	if !ok {
		return fmt.Errorf("token not found in auth response")
	}
	c.token = token
	return nil
}

// Get fetches data from an endpoint with a query body parameter.
func (c *PhysioClient) Get(endpoint string, query string) (string, error) {
	import_url := c.baseURL + endpoint + "?body=" + url.QueryEscape(query)
	req, err := http.NewRequest("GET", import_url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create GET request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("GET request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return string(respBody), fmt.Errorf("GET failed with status %d: %s", resp.StatusCode, string(respBody))
	}
	return string(respBody), nil
}

// Register creates a new user account via the /register endpoint.
// captcha can be empty in dev mode (shallow security provider).
func (c *PhysioClient) Register(username, password string) error {
	regData := map[string]string{
		"user":    username,
		"pass":    password,
		"captcha": "",
	}
	body, _ := json.Marshal(regData)
	resp, err := c.client.Post(c.baseURL+"/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("register request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("register failed (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (c *PhysioClient) Put(endpoint string, data interface{}) (string, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal data: %w", err)
	}

	req, err := http.NewRequest("PUT", c.baseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return string(respBody), fmt.Errorf("PUT failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return string(respBody), nil
}

func (c *PhysioClient) Post(endpoint string, data interface{}) (string, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal data: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return string(respBody), fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return string(respBody), nil
}

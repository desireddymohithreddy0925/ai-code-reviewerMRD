package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type GitHubEvent struct {
	PullRequest struct {
		Number int `json:"number"`
	} `json:"pull_request"`
	Repository struct {
		Name  string `json:"name"`
		Owner struct {
			Login string `json:"login"`
		} `json:"owner"`
	} `json:"repository"`
}

func main() {
	fmt.Println("🚀 RepoSage Go Runtime (Blazing Fast CI)")
	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		fmt.Println("Error: GITHUB_TOKEN is not set")
		os.Exit(1)
	}
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		fmt.Println("Error: GROQ_API_KEY is not set")
		os.Exit(1)
	}

	eventPath := os.Getenv("GITHUB_EVENT_PATH")
	if eventPath == "" {
		fmt.Println("Error: GITHUB_EVENT_PATH is not set")
		os.Exit(1)
	}

	eventFile, err := os.ReadFile(eventPath)
	if err != nil {
		fmt.Printf("Error reading event file: %v\n", err)
		os.Exit(1)
	}

	var event GitHubEvent
	if err := json.Unmarshal(eventFile, &event); err != nil {
		fmt.Printf("Error parsing event JSON: %v\n", err)
		os.Exit(1)
	}

	owner := event.Repository.Owner.Login
	repo := event.Repository.Name
	prNumber := event.PullRequest.Number

	if prNumber == 0 {
		fmt.Println("Not a Pull Request event, skipping...")
		return
	}

	fmt.Printf("Analyzing PR #%d for %s/%s...\n", prNumber, owner, repo)

	diff, err := fetchDiff(owner, repo, prNumber, token)
	if err != nil {
		fmt.Printf("Error fetching diff: %v\n", err)
		os.Exit(1)
	}

	if len(diff) > 10000 {
		diff = diff[:10000] + "\n...[diff truncated]"
	}

	fmt.Println("Calling LLM API...")
	review, err := callLLM(diff, apiKey)
	if err != nil {
		fmt.Printf("LLM error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Posting GitHub Comment...")
	err = postComment(owner, repo, prNumber, token, review)
	if err != nil {
		fmt.Printf("GitHub comment error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Review completed in record time!")
}

func fetchDiff(owner, repo string, pullNumber int, token string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d", owner, repo, pullNumber)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3.diff")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("GitHub returned status: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	return string(body), nil
}

func callLLM(diff, apiKey string) (string, error) {
	prompt := fmt.Sprintf("Review the following pull request diff for bugs, security vulnerabilities, and code optimizations. Provide your review in markdown format:\n\n%s", diff)
	
	payload := map[string]interface{}{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]string{
			{"role": "system", "content": "You are RepoSage, an elite AI code reviewer."},
			{"role": "user", "content": prompt},
		},
	}
	
	jsonPayload, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonPayload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("LLM API returned status: %d", resp.StatusCode)
	}
	
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}
	return "No review generated.", nil
}

func postComment(owner, repo string, pullNumber int, token, review string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments", owner, repo, pullNumber)
	
	comment := fmt.Sprintf("### 🤖 RepoSage Code Review (Fast Go Runtime ⚡)\n\n%s", review)
	payload := map[string]string{"body": comment}
	jsonPayload, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 201 {
		return fmt.Errorf("GitHub returned status: %d", resp.StatusCode)
	}
	
	return nil
}

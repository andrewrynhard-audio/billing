package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Settings is the struct we serialize to disk, can contain more fields as needed.
type Settings struct {
	APIKey string `json:"apiKey"`
}

// getConfigDir locates the user's OS-appropriate config directory.
// e.g. macOS -> ~/Library/Application Support, Linux -> ~/.config, Windows -> %AppData%
func getConfigDir() (string, error) {
	base, err := os.UserConfigDir() // Go standard library: returns OS-specific config dir
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}
	// Name your subfolder after your app
	final := filepath.Join(base, "Billing")
	// Ensure the directory exists
	if err := os.MkdirAll(final, 0o700); err != nil {
		return "", fmt.Errorf("failed to create config directory: %w", err)
	}
	return final, nil
}

// SaveSettings writes the user’s settings (APIKey, etc.) to a JSON file in the config dir.
func SaveSettings(apiKey string) error {
	confDir, err := getConfigDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(confDir, "settings.json")

	data := Settings{APIKey: apiKey}
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	// 0600 => Owner can read/write, others can't
	if err := os.WriteFile(configPath, jsonBytes, 0o600); err != nil {
		return fmt.Errorf("failed to write settings.json: %w", err)
	}
	return nil
}

// LoadSettings loads the settings.json file if it exists.
func LoadSettings() (*Settings, error) {
	confDir, err := getConfigDir()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(confDir, "settings.json")

	content, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			// Settings file doesn't exist yet -> return empty settings
			return &Settings{}, nil
		}
		return nil, fmt.Errorf("failed to read settings.json: %w", err)
	}

	var s Settings
	if err := json.Unmarshal(content, &s); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return &s, nil
}

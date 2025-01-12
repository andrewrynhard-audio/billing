import React, { useState, useEffect } from 'react';
import { GetSettings, SetAPIKey } from '../../wailsjs/go/main/App';

function Spinner() {
    return (
        <div className="loading-indicator">
            <p>Saving settings...</p>
            <div className="spinner"></div>
        </div>
    );
}

const SettingsView: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);       // loading settings from backend
    const [saving, setSaving] = useState(false);        // saving to backend
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Load the current settings at startup
    useEffect(() => {
        async function fetchSettings() {
            setLoading(true);
            try {
                const settings = await GetSettings();
                // e.g. { apiKey: '...' }
                if (settings && settings.apiKey) {
                    setApiKey(settings.apiKey);
                }
                setLoading(false);
            } catch (error) {
                console.error('Failed to load settings', error);
                setLoading(false);
            }
        }
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus('idle');
        try {
            await SetAPIKey(apiKey);
            setStatus('success');
        } catch (error) {
            console.error('Failed to save API key', error);
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div>
                <p>Loading settings...</p>
                <Spinner />
            </div>
        );
    }

    return (
        <div>
            <h2>Settings</h2>

            {saving && <Spinner />}
            {status === 'success' && <p style={{ color: 'green' }}>Saved successfully!</p>}
            {status === 'error' && <p style={{ color: 'red' }}>Error saving API key.</p>}

            <form onSubmit={handleSave} style={{ opacity: saving ? 0.5 : 1 }}>
                <label>API Key:</label>
                <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={saving}
                    style={{ width: 300 }}
                />

                <div style={{ marginTop: '1em' }}>
                    <button type="submit" disabled={saving}>
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsView;

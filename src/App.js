import React, { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback';
import Login from './Login';
import './App.css';

function App() {
    const [token, setToken] = useState('');

    useEffect(() => {
        async function getToken() {
            try {
                const response = await fetch('/auth/token');
                if (response.ok) {
                    const json = await response.json();
                    setToken(json.access_token);
                } else {
                    throw new Error('Failed to fetch token');
                }
            } catch (error) {
                console.error('Error fetching token:', error);
                // Handle token retrieval error here
            }
        }

        getToken();
    }, []);

    const handleTokenExpired = () => {
        // Implement token refresh logic here
    };

    return (
        <>
            {token ? <WebPlayback token={token} onTokenExpired={handleTokenExpired} /> : <Login />}
        </>
    );
}

export default App;

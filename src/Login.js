import React from 'react';

function Login() {
    return (
        <div className="App">
            <header className="App-header">
                <a className='text'>Welcome</a>
                <a className="btn" href="/auth/login">
                    Login with Spotify 
                </a>
            </header>
        </div>
    );
}

export default Login;

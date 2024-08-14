import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Card } from 'react-bootstrap';

function WebPlayback(props) {
    const [isPaused, setPaused] = useState(false);
    const [isActive, setActive] = useState(false);
    const [player, setPlayer] = useState(undefined);
    const [currentTrack, setTrack] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [genre, setGenre] = useState('');
    const [genres, setGenres] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [recommendedTracks, setRecommendedTracks] = useState([]);
    const [deviceID, setDeviceID] = useState('');

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Web Playback SDK',
                getOAuthToken: cb => { cb(props.token); },
                volume: 0.5
            });

            setPlayer(player);

            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setActive(true);
                setDeviceID(device_id);
                transferPlayback(device_id);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setActive(false);
            });

            player.addListener('player_state_changed', (state) => {
                if (!state) {
                    return;
                }
                const track = state.track_window.current_track;
                setTrack(track);
                setPaused(state.paused);
            });

            player.connect();
        };

        // Fetch available genres
        axios.get('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            headers: {
                Authorization: `Bearer ${props.token}`
            }
        }).then(response => {
            setGenres(response.data.genres);
        }).catch(error => {
            console.error('Error fetching genres:', error);
        });

    }, [props.token]);

    const transferPlayback = (deviceId) => {
        axios.put(
            'https://api.spotify.com/v1/me/player',
            { device_ids: [deviceId] },
            {
                headers: {
                    Authorization: `Bearer ${props.token}`,
                    'Content-Type': 'application/json'
                }
            }
        ).then(response => {
            console.log('Playback transferred successfully');
        }).catch(error => {
            console.error('Error transferring playback:', error);
                if (error.response && error.response.status === 401) {
                    // Handle token error (e.g., refresh token)
                    console.log('Token expired or unauthorized, please re-authenticate');
                }
            });
    };

    const handleSearch = () => {
        let query = searchQuery;

        // Clear recommended tracks when searching
        setRecommendedTracks([]);

        // Search for tracks in Spotify API
        axios.get(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
            headers: {
                Authorization: `Bearer ${props.token}`
            }
        }).then(response => {
            setSearchResults(response.data.tracks.items);
        }).catch(error => {
            console.error('Error searching for tracks:', error);
        });

        axios.post('http://localhost:5000/download', {
            query: query
        }).then(downloadResponse => {
            console.log('Download triggered:', downloadResponse.data.downloadPath);
            setGenre(downloadResponse.data.genre); // Set the genre state here
        }).catch(downloadError => {
            console.error('Error triggering download:', downloadError);
        });
    };

    const handleRecommend = () => {
        // Call the backend to get recommended tracks
        axios.post('http://localhost:5000/fetch-tracks', {
            genre: genre
        }).then(response => {
            setSearchResults([]);
            setRecommendedTracks(response.data.tracks);
        }).catch(error => {
            console.error('Error getting recommendations:', error);
        });
    };

    const playTrack = (uri) => {
        if (deviceID) {
            axios.put('https://api.spotify.com/v1/me/player/play', { uris: [uri] }, {
                headers: {
                    Authorization: `Bearer ${props.token}`
                }
            }).then(response => {
                console.log('Track playing:', response);
            }).catch(error => {
                console.error('Error playing track:', error);
            });
        } else {
            console.error('No active device ID found');
        }
    };

    const previousTrack = () => {
        player && player.previousTrack();
    };

    const nextTrack = () => {
        player && player.nextTrack();
    };

    return (
        <div className="header">
            ROBIFY
            <div className="container">
                <div className="main-wrapper">
                    {/* Search section */}
                    <div className="search-container">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for a track..."
                        />
                        <button onClick={handleSearch}>Search</button>
                        <button onClick={handleRecommend}>Predict Genre and Recommend</button>
                    </div>

                    {/* Player section */}
                    <div className="now-playing__info">
                        <img src={currentTrack.album ? currentTrack.album.images[0].url : ''} className="now-playing__cover" alt="" />
                        <div className="now-playing__side">
                            <div className="now-playing__name">{currentTrack.name}</div>
                            <div className="now-playing__artist">{currentTrack.artists ? currentTrack.artists[0].name : ''}</div>
                            <button className="btn" onClick={previousTrack}>&lt;&lt;</button>
                            <button className="btn" onClick={() => player && player.togglePlay()}>{isPaused ? "PLAY" : "PAUSE"}</button>
                            <button className="btn" onClick={nextTrack}>&gt;&gt;</button>
                        </div>
                    </div>

                    {/* Search results section */}
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            <Row xs={1} sm={2} md={4} lg={5}>
                                {searchResults.map(track => (
                                    <Col key={track.id}>
                                        <Card style={{ marginBottom: '20px' }}>
                                            <Card.Img variant="top" src={track.album.images[0].url} style={{ width: '100%', height: 'auto' }} />
                                            <Card.Body>
                                                <Card.Title>{track.name}</Card.Title>
                                                <Card.Text>
                                                    {track.artists[0].name}
                                                </Card.Text>
                                                <Button variant="primary" onClick={() => playTrack(track.uri)}>Play</Button>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    )}

                    {/* Recommended tracks section */}
                    {recommendedTracks.length > 0 && (
                        <div className="recommended-results">
                            <h3>Recommended Tracks</h3>
                            <h4>Genre:{genre}</h4>
                            <Row xs={1} sm={2} md={4} lg={5}>
                                {recommendedTracks.map((track, index) => {
                                    // Generate a random index for the first track
                                    const randomIndex = Math.floor(Math.random() * recommendedTracks.length);
                                    // Use the randomIndex to select the first track
                                    const firstRandomTrack = recommendedTracks[randomIndex];

                                    // If it's the first track, render it using the firstRandomTrack
                                    if (index === 0) {
                                        return (
                                            <Col key={firstRandomTrack.id}>
                                                <Card style={{ marginBottom: '20px' }}>
                                                    <Card.Img variant="top" src={firstRandomTrack.album.images[0].url} style={{ width: '100%', height: 'auto' }} />
                                                    <Card.Body>
                                                        <Card.Title>{firstRandomTrack.name}</Card.Title>
                                                        <Card.Text>
                                                            {firstRandomTrack.artists[0].name}
                                                        </Card.Text>
                                                        <Button variant="primary" onClick={() => playTrack(firstRandomTrack.uri)}>Play</Button>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        );
                                    }

                                    // For other tracks, render them as usual
                                    return (
                                        <Col key={track.id}>
                                            <Card style={{ marginBottom: '20px' }}>
                                                <Card.Img variant="top" src={track.album.images[0].url} style={{ width: '100%', height: 'auto' }} />
                                                <Card.Body>
                                                    <Card.Title>{track.name}</Card.Title>
                                                    <Card.Text>
                                                        {track.artists[0].name}
                                                    </Card.Text>
                                                    <Button variant="primary" onClick={() => playTrack(track.uri)}>Play</Button>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default WebPlayback;

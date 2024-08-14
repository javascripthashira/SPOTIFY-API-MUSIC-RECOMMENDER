const express = require('express');
const ytdl = require('ytdl-core');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const cors = require('cors');
const FormData = require('form-data');

dotenv.config();

const spotify_client_id = "b360e79fd4884e19a4b57a06dbb6ddbc";
const spotify_client_secret = "da8d8fdf854b4329a4995c61d2596dbe";
const spotify_redirect_uri = 'http://localhost:3000/auth/callback';
const YOUTUBE_API_KEY = 'AIzaSyDcJjusCB08XtI9nXFGGb7_GRyn1RJ_doo';
const downloadPath = 'C:/Users/revolve/Downloads';

const port = 5000;
const pythonServerUrl = 'http://127.0.0.1:5001/predict'; // Python server URL

global.access_token = '';

const generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/auth/login', (req, res) => {
    const scope = "streaming user-read-email user-read-private";
    const state = generateRandomString(16);

    const auth_query_parameters = new URLSearchParams({
        response_type: "code",
        client_id: spotify_client_id,
        scope: scope,
        redirect_uri: spotify_redirect_uri,
        state: state
    });

    res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
});

app.get('/auth/callback', (req, res) => {
    const code = req.query.code;

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        data: new URLSearchParams({
            code: code,
            redirect_uri: spotify_redirect_uri,
            grant_type: 'authorization_code'
        }),
        headers: {
            'Authorization': 'Basic ' + Buffer.from(spotify_client_id + ':' + spotify_client_secret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    axios.post(authOptions.url, authOptions.data, { headers: authOptions.headers })
        .then(response => {
            if (response.status === 200) {
                access_token = response.data.access_token;
                res.redirect('/');
            }
        })
        .catch(error => {
            console.error('Error fetching access token:', error);
            res.status(500).send('Error fetching access token');
        });
});

app.get('/auth/token', (req, res) => {
    res.json({ access_token: access_token });
});

app.post('/download', async (req, res) => {
    try {
        const { query } = req.body;
        const youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=1`;
        const searchResponse = await axios.get(youtubeSearchUrl);
        if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
            throw new Error('No video found for the query');
        }
        const videoId = searchResponse.data.items[0].id.videoId;
        const downloadPath = await downloadVideo(videoId);
        const genre = await sendToPythonServer(downloadPath);

        res.send({ downloadPath, genre });
    } catch (error) {
        console.error('Error fetching video information:', error.message);
        res.status(500).send('Error fetching video information');
    }
});

app.post('/fetch-tracks', async (req, res) => {
    try {
        const { genre } = req.body;
        const tracks = await fetchTracksByGenre(genre);
        res.send({ genre, tracks });
    } catch (error) {
        console.error('Error fetching tracks by genre:', error);
        res.status(500).send('Error fetching tracks by genre');
    }
});

async function downloadVideo(videoId) {
    try {
        const info = await ytdl.getInfo(videoId);
        const format = ytdl.chooseFormat(info.formats, { filter: (format) => format.hasVideo && format.hasAudio });
        if (!format) {
            throw new Error('No suitable format found');
        }
        const outputFilePath = `${downloadPath}/${info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '')}.${format.container}`;
        const outputStream = fs.createWriteStream(outputFilePath);
        ytdl.downloadFromInfo(info, { format: format }).pipe(outputStream);
        return new Promise((resolve, reject) => {
            outputStream.on('finish', () => {
                resolve(outputFilePath);
            });
            outputStream.on('error', (error) => {
                console.error('Error writing the file:', error.message);
                reject(error);
            });
        });
    } catch (error) {
        console.error('Error downloading video:', error.message);
        throw error;
    }
}

async function sendToPythonServer(filePath) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post(pythonServerUrl, form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        return response.data.genre;
    } catch (error) {
        console.error('Error sending file to Python server:', error.message);
        throw error;
    }
}

async function fetchTracksByGenre(genre) {
    try {
        const response = await axios.get(`https://api.spotify.com/v1/search?q=genre:%22${genre}%22&type=track&limit=20&market=US`, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        return response.data.tracks.items;
    } catch (error) {
        console.error('Error fetching tracks by genre:', error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

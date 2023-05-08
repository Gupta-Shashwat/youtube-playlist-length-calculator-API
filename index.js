import express from 'express';
import dotenv from 'dotenv';
import { Router } from 'express';
import axios from 'axios';
import cors from 'cors';

dotenv.config();

const router = Router();
const app = express();
const yt_api = process.env.API;
const PORT = process.env.PORT || 5000;

app.use(cors());

const fetchLength = async (req, res) => {
    try {
        const { ytplaylist_id } = req.params;
        const len = await lengthCalculator(ytplaylist_id);
        res.status(200).json(len);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
}

const lengthCalculator = async (playlist_id) => {
    const URL1 = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&fields=items(contentDetails(videoId)),nextPageToken&key=${yt_api}&playlistId=${playlist_id}&pageToken=`;
    const URL2 = `https://www.googleapis.com/youtube/v3/videos?&part=contentDetails&key=${yt_api}&id=`;
    let next_page = '';
    let cnt = 0;
    let totalSeconds = 0;
    let videos_not_counted = "";

    async function getVideoDuration(videoId) {
        const response = await axios.get(`${URL2}${videoId}`);
        const data = await response.data;
        try {
            const duration = data.items[0].contentDetails.duration;
            const timeArray = duration.match(/(\d+)(?=[MHS])/g);
            const seconds = parseInt(timeArray.pop() || '0');
            const minutes = parseInt(timeArray.pop() || '0');
            const hours = parseInt(timeArray.pop() || '0');
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            return totalSeconds;
        } catch (e) {
            videos_not_counted += `Error while fetching duration of ${videoId}\nThis vedio's duration is excluded`;
            videos_not_counted += `Data fetched about this video:\n${data}`;
            return 0;
        }
    }

    while (true) {
        const vidList = [];
        const response = await axios.get(URL1 + next_page);
        const results = await response.data;
        for (const x of results.items) {
            vidList.push(x.contentDetails.videoId);
        }

        const urlList = vidList.join(',');
        cnt += vidList.length;

        const durations = await Promise.all(urlList.split(',').map(getVideoDuration));
        totalSeconds += durations.reduce((sum, seconds) => sum + seconds);

        if ('nextPageToken' in results) {
            next_page = results.nextPageToken;
        } else {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const playlistLength = {
                "No_of_videos": cnt,
                "total_length_in_seconds": totalSeconds,
                "length": {
                    "seconds": seconds,
                    "minutes": minutes,
                    "hours": hours
                },
                "Videos_not_counted": videos_not_counted
            }
            return playlistLength;
        }
    }
}

router.get('/:ytplaylist_id', fetchLength);

app.use('/', router);
app.listen(PORT, () => console.log(`Server started to listen on port: ${PORT}`))

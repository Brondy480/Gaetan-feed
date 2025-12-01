import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import articleRoutes from './routes/articles.js';
import { fetchAllFeeds, RSS_FEEDS } from './services/feedServices.js';

dotenv.config();

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cfo-feeds')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('Mongo Error:', err));

app.use('/api/articles', articleRoutes);

app.post('/api/fetch-feeds', async (req, res) => {
  try {
    const feeds = req.body.feeds || RSS_FEEDS;
    fetchAllFeeds(feeds); // fire-and-forget, non-blocking
    res.json({ message: 'Feeds fetching started in background' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule background feed fetch every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    await fetchAllFeeds();
  } catch (err) {
    console.error('Scheduled fetch failed:', err.message);
  }
});

// Fire initial fetch asynchronously in background (non-blocking)
(async () => {
  console.log('📡 Initial feed fetch starting in background...');
  fetchAllFeeds().then(() => console.log('✅ Initial feed fetch completed'))
               .catch(err => console.error('Initial fetch failed:', err));
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

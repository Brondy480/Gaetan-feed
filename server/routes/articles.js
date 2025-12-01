import express from 'express';
import Article from '../models/articles.js';

const router = express.Router();

router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Article.countDocuments();
    const byCategory = await Article.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const saved = await Article.countDocuments({ isSaved: true });
    const unread = await Article.countDocuments({ isRead: false });

    res.json({ total, byCategory, saved, unread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const { category, saved } = req.query;

    const query = {};
    if (category && category !== 'all') query.category = category;
    if (saved === 'true') query.isSaved = true;

    const articles = await Article.find(query)
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/save', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    article.isSaved = !article.isSaved;
    await article.save();

    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

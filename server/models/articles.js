import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  category: {
    type: String,
    enum: [
      'Capital Strategy',
      'Private Markets & M&A',
      'Operational Excellence',
      'Leadership & Conscious CFO',
      'Africa Finance',
      'Uncategorized'
    ],
    default: 'Uncategorized'
  },
  description: { type: String },
  image: { type: String, default: null },
  publishedDate: { type: Date, default: Date.now },
  relevanceScore: { type: Number, min: 1, max: 5, default: 3 },
  isRead: { type: Boolean, default: false },
  isSaved: { type: Boolean, default: false }
}, { timestamps: true });

articleSchema.index({ category: 1, publishedDate: -1 });
articleSchema.index({ relevanceScore: -1 });
articleSchema.index({ isSaved: 1, isRead: 1 });

export default mongoose.model('Article', articleSchema);

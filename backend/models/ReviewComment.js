import mongoose from 'mongoose';

const reviewCommentSchema = new mongoose.Schema({
  repo: {
    type: String,
    required: true,
    index: true
  },
  pullNumber: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  snippetHash: {
    type: String,
    required: true,
    index: true
  },
  commentBody: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // TTL index: auto-delete comments older than 30 days
  }
});

// Compound index for ultra-fast deduplication lookups
reviewCommentSchema.index({ repo: 1, filePath: 1, snippetHash: 1 });

export const ReviewComment = mongoose.model('ReviewComment', reviewCommentSchema);

import mongoose from 'mongoose';

const complexityTrendSchema = new mongoose.Schema({
  repo: {
    type: String,
    required: true,
    index: true
  },
  branch: {
    type: String,
    required: true
  },
  pullNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  cyclomaticDelta: {
    type: Number,
    required: true
  },
  halsteadEffortDelta: {
    type: Number,
    required: true
  },
  topComplexFiles: [{
    path: String,
    ccDelta: Number,
    effortDelta: Number
  }]
});

export const ComplexityTrend = mongoose.model('ComplexityTrend', complexityTrendSchema);

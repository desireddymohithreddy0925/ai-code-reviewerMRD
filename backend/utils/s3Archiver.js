import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as parquet from 'parquetjs-lite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

/**
 * Streams sanitized AI Code Review payloads to an AWS S3 Dataset Bucket
 * in Parquet format for future LoRA fine-tuning and model training.
 */
export class S3Archiver {
  constructor() {
    this.bucketName = process.env.S3_DATASET_BUCKET;
    this.enabled = !!this.bucketName;

    if (this.enabled) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        }
      });
      
      this.schema = new parquet.ParquetSchema({
        repo: { type: 'UTF8' },
        prompt: { type: 'UTF8' },
        aiResponse: { type: 'UTF8' },
        timestamp: { type: 'TIMESTAMP_MILLIS' }
      });
    }
  }

  async streamToDataset(repo, diffText, aiResponse) {
    if (!this.enabled) return;

    const tmpFilePath = path.join(os.tmpdir(), `dataset-${Date.now()}-${Math.random().toString(36).substring(7)}.parquet`);

    try {
      const writer = await parquet.ParquetWriter.openFile(this.schema, tmpFilePath);
      await writer.appendRow({
        repo: repo || 'unknown',
        prompt: diffText || '',
        aiResponse: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
        timestamp: Date.now()
      });
      await writer.close();

      const fileBuffer = await promisify(fs.readFile)(tmpFilePath);
      const s3Key = `code-reviews/${new Date().toISOString().split('T')[0]}/${path.basename(tmpFilePath)}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/octet-stream'
      });

      await this.s3Client.send(command);
      console.log(`🚀 [S3 Archiver] Successfully streamed ML dataset to s3://${this.bucketName}/${s3Key}`);
    } catch (err) {
      console.error(`⚠️ [S3 Archiver] Failed to archive dataset: ${err.message}`);
    } finally {
      try {
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
      } catch (cleanupErr) {
        console.warn(`[S3 Archiver] Cleanup warning: ${cleanupErr.message}`);
      }
    }
  }
}

export const s3Archiver = new S3Archiver();

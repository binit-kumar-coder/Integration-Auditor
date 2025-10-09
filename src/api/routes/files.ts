/**
 * File Upload Routes
 * Enterprise-grade file upload APIs for CSV data
 * Supports gigabyte-sized files with streaming and chunked uploads
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export const filesRoutes = Router();

// Configure multer for large file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tier = req.params['tier'] || 'tier1';
    const uploadDir = `./input/${tier}`;
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename or use CSV type
    const filename = file.originalname || `${req.body.csvType || 'data'}.csv`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
    fieldSize: 100 * 1024 * 1024 // 100MB field size
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * @swagger
 * /api/files/upload/tier/{tier}:
 *   post:
 *     tags: [Files]
 *     summary: Upload CSV File to Tier
 *     description: Upload CSV files for processing (supports gigabyte-sized files)
 *     consumes:
 *       - multipart/form-data
 */
filesRoutes.post('/upload/tier/:tier', upload.single('csvFile'), async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const csvType = req.body.csvType; // integrations, imports, exports, flows, connections
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'No file uploaded',
        acceptedTypes: ['text/csv'],
        maxSize: '10GB'
      });
    }

    if (!csvType) {
      return res.status(400).json({
        error: 'CSV type is required',
        acceptedTypes: ['integrations', 'imports', 'exports', 'flows', 'connections']
      });
    }

    // Validate CSV type
    const validCsvTypes = ['integrations', 'imports', 'exports', 'flows', 'connections'];
    if (!validCsvTypes.includes(csvType)) {
      return res.status(400).json({
        error: `Invalid CSV type: ${csvType}`,
        acceptedTypes: validCsvTypes
      });
    }

    // Move file to correct name if needed
    const targetPath = `./input/${tier}/${csvType}.csv`;
    if (file.path !== targetPath) {
      await fs.rename(file.path, targetPath);
    }

    // Get file stats
    const stats = await fs.stat(targetPath);

    return res.json({
      status: 'success',
      message: 'File uploaded successfully',
      file: {
        tier,
        csvType,
        originalName: file.originalname,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        path: targetPath,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'File upload failed',
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/files/upload/tier/{tier}/batch:
 *   post:
 *     tags: [Files]
 *     summary: Upload Multiple CSV Files to Tier
 *     description: Upload multiple CSV files for a tier in one request
 */
filesRoutes.post('/upload/tier/:tier/batch', upload.array('csvFiles', 10), async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Upload one or more CSV files'
      });
    }

    const results = [];
    const validCsvTypes = ['integrations', 'imports', 'exports', 'flows', 'connections'];

    for (const file of files) {
      try {
        // Determine CSV type from filename
        const csvType = file.originalname.replace('.csv', '');
        
        if (!validCsvTypes.includes(csvType)) {
          results.push({
            filename: file.originalname,
            status: 'error',
            error: `Invalid CSV type: ${csvType}`
          });
          continue;
        }

        // Move to correct location
        const targetPath = `./input/${tier}/${csvType}.csv`;
        await fs.rename(file.path, targetPath);

        const stats = await fs.stat(targetPath);
        results.push({
          filename: file.originalname,
          csvType,
          status: 'success',
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          path: targetPath
        });

      } catch (error) {
        results.push({
          filename: file.originalname,
          status: 'error',
          error: (error as Error).message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return res.json({
      status: errorCount === 0 ? 'success' : 'partial',
      tier,
      summary: {
        totalFiles: files.length,
        successful: successCount,
        failed: errorCount
      },
      results,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Batch upload failed',
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/files/chunked-upload/start:
 *   post:
 *     tags: [Files]
 *     summary: Start Chunked Upload
 *     description: Start chunked upload for very large files (>1GB)
 */
filesRoutes.post('/chunked-upload/start', async (req: Request, res: Response) => {
  try {
    const { filename, fileSize, csvType, tier, chunkSize = 10485760 } = req.body; // Default 10MB chunks

    if (!filename || !fileSize || !csvType || !tier) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['filename', 'fileSize', 'csvType', 'tier']
      });
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const uploadDir = `./uploads/chunked/${uploadId}`;
    await fs.mkdir(uploadDir, { recursive: true });

    // Create upload metadata
    const metadata = {
      uploadId,
      filename,
      fileSize,
      csvType,
      tier,
      chunkSize,
      chunksReceived: 0,
      totalChunks: Math.ceil(fileSize / chunkSize),
      status: 'started',
      startedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(uploadDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return res.json({
      status: 'success',
      uploadId,
      metadata: {
        totalChunks: metadata.totalChunks,
        chunkSize,
        uploadUrl: `/api/files/chunked-upload/${uploadId}/chunk`
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to start chunked upload',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/chunked-upload/{uploadId}/chunk:
 *   post:
 *     tags: [Files]
 *     summary: Upload File Chunk
 *     description: Upload a single chunk of a large file
 */
filesRoutes.post('/chunked-upload/:uploadId/chunk', upload.single('chunk'), async (req: Request, res: Response) => {
  try {
    const uploadId = req.params['uploadId'];
    const chunkNumber = parseInt(req.body.chunkNumber);
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'No chunk uploaded'
      });
    }

    const uploadDir = `./uploads/chunked/${uploadId}`;
    const metadataPath = path.join(uploadDir, 'metadata.json');
    
    // Load metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    // Save chunk
    const chunkPath = path.join(uploadDir, `chunk_${chunkNumber.toString().padStart(6, '0')}`);
    await fs.rename(file.path, chunkPath);

    // Update metadata
    metadata.chunksReceived++;
    metadata.lastChunkAt = new Date().toISOString();

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return res.json({
      status: 'success',
      uploadId,
      chunkNumber,
      chunksReceived: metadata.chunksReceived,
      totalChunks: metadata.totalChunks,
      progress: Math.round((metadata.chunksReceived / metadata.totalChunks) * 100),
      completed: metadata.chunksReceived === metadata.totalChunks
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Chunk upload failed',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/chunked-upload/{uploadId}/complete:
 *   post:
 *     tags: [Files]
 *     summary: Complete Chunked Upload
 *     description: Assemble chunks into final CSV file
 */
filesRoutes.post('/chunked-upload/:uploadId/complete', async (req: Request, res: Response) => {
  try {
    const uploadId = req.params['uploadId'];
    const uploadDir = `./uploads/chunked/${uploadId}`;
    const metadataPath = path.join(uploadDir, 'metadata.json');
    
    // Load metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    if (metadata.chunksReceived !== metadata.totalChunks) {
      return res.status(400).json({
        error: 'Upload incomplete',
        received: metadata.chunksReceived,
        expected: metadata.totalChunks
      });
    }

    // Assemble chunks into final file
    const tierDir = `./input/${metadata.tier}`;
    await fs.mkdir(tierDir, { recursive: true });
    const finalPath = path.join(tierDir, `${metadata.csvType}.csv`);
    const writeStream = createWriteStream(finalPath);

    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk_${i.toString().padStart(6, '0')}`);
        const readStream = createReadStream(chunkPath);
        await pipeline(readStream, writeStream, { end: false });
      }
      writeStream.end();

      // Get final file stats
      const finalStats = await fs.stat(finalPath);

      // Cleanup chunks
      await fs.rm(uploadDir, { recursive: true });

      return res.json({
        status: 'success',
        message: 'File assembled successfully',
        file: {
          tier: metadata.tier,
          csvType: metadata.csvType,
          filename: metadata.filename,
          size: finalStats.size,
          sizeFormatted: formatFileSize(finalStats.size),
          path: finalPath,
          completedAt: new Date().toISOString()
        }
      });

    } catch (assemblyError) {
      return res.status(500).json({
        error: 'File assembly failed',
        details: (assemblyError as Error).message
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to complete upload',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/list:
 *   get:
 *     tags: [Files]
 *     summary: List Uploaded Files
 *     description: List all uploaded CSV files by tier and type
 */
filesRoutes.get('/list', async (req: Request, res: Response) => {
  try {
    const { tier } = req.query;
    const inputDir = './input';
    
    const result: any = {
      status: 'success',
      files: {},
      timestamp: new Date().toISOString()
    };

    // Get all tiers or specific tier
    const tiers = tier ? [tier as string] : ['tier1', 'tier2', 'tier3'];
    
    for (const tierName of tiers) {
      const tierPath = path.join(inputDir, tierName);
      result.files[tierName] = {};

      try {
        const files = await fs.readdir(tierPath);
        const csvFiles = files.filter(f => f.endsWith('.csv'));

        for (const csvFile of csvFiles) {
          const filePath = path.join(tierPath, csvFile);
          const stats = await fs.stat(filePath);
          const csvType = csvFile.replace('.csv', '');

          result.files[tierName][csvType] = {
            filename: csvFile,
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            lastModified: stats.mtime.toISOString(),
            path: filePath
          };
        }
      } catch (error) {
        result.files[tierName] = { error: 'Tier directory not found' };
      }
    }

    return res.json(result);

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list files',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/tier/{tier}/csv/{csvType}:
 *   get:
 *     tags: [Files]
 *     summary: Get CSV File Info
 *     description: Get information about a specific CSV file
 */
filesRoutes.get('/tier/:tier/csv/:csvType', async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const csvType = req.params['csvType'];
    const filePath = `./input/${tier}/${csvType}.csv`;

    try {
      const stats = await fs.stat(filePath);
      
      // Get first few lines for preview
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      const preview = lines.slice(0, 10); // First 10 lines

      return res.json({
        status: 'success',
        file: {
          tier,
          csvType,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          lastModified: stats.mtime.toISOString(),
          lineCount: lines.length - 1, // Exclude last empty line
          path: filePath,
          preview: {
            header: lines[0],
            sampleRows: preview.slice(1, 6) // 5 sample rows
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (fileError) {
      return res.status(404).json({
        error: `CSV file not found: ${csvType} in ${tier}`,
        path: filePath
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get file info',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/tier/{tier}/csv/{csvType}:
 *   delete:
 *     tags: [Files]
 *     summary: Delete CSV File
 *     description: Delete a specific CSV file from a tier
 */
filesRoutes.delete('/tier/:tier/csv/:csvType', async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const csvType = req.params['csvType'];
    const filePath = `./input/${tier}/${csvType}.csv`;

    try {
      await fs.unlink(filePath);
      
      return res.json({
        status: 'success',
        message: `Deleted ${csvType}.csv from ${tier}`,
        file: {
          tier,
          csvType,
          path: filePath
        },
        deletedAt: new Date().toISOString()
      });

    } catch (fileError) {
      return res.status(404).json({
        error: `CSV file not found: ${csvType} in ${tier}`,
        path: filePath
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to delete file',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/files/validate/tier/{tier}:
 *   post:
 *     tags: [Files]
 *     summary: Validate Tier CSV Files
 *     description: Validate all CSV files in a tier for completeness and format
 */
filesRoutes.post('/validate/tier/:tier', async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const requiredFiles = ['integrations.csv', 'imports.csv', 'exports.csv', 'flows.csv', 'connections.csv'];
    const tierPath = `./input/${tier}`;
    
    const validation = {
      tier,
      status: 'success',
      files: {} as any,
      summary: {
        totalRequired: requiredFiles.length,
        present: 0,
        missing: 0,
        totalSize: 0
      },
      validatedAt: new Date().toISOString()
    };

    for (const requiredFile of requiredFiles) {
      const filePath = path.join(tierPath, requiredFile);
      const csvType = requiredFile.replace('.csv', '');

      try {
        const stats = await fs.stat(filePath);
        
        // Basic CSV validation - check if it has headers
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const hasHeader = lines.length > 0 && lines[0].includes(',');

        validation.files[csvType] = {
          present: true,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          lineCount: lines.length - 1,
          hasHeader,
          lastModified: stats.mtime.toISOString(),
          status: hasHeader ? 'valid' : 'warning'
        };

        validation.summary.present++;
        validation.summary.totalSize += stats.size;

      } catch (fileError) {
        validation.files[csvType] = {
          present: false,
          status: 'missing',
          error: 'File not found'
        };
        validation.summary.missing++;
        validation.status = 'incomplete';
      }
    }

    return res.json(validation);

  } catch (error) {
    return res.status(500).json({
      error: 'Validation failed',
      details: (error as Error).message
    });
  }
});

/**
 * Helper function to format file sizes
 */
function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

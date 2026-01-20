/**
 * Upload music files to Vercel Blob storage
 *
 * Usage:
 *   cd apps/nextjs
 *   npx tsx scripts/upload-music.ts /path/to/music/folder
 *
 * This script will:
 * 1. Find all .mp3 and .m4a files in the specified folder
 * 2. Upload each to Vercel Blob under music/{filename}
 * 3. Output the URLs for updating the database
 */

import { put } from "@vercel/blob";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const SUPPORTED_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav"];
const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
};

interface UploadResult {
  filename: string;
  extension: string;
  url: string;
  size: number;
}

async function uploadMusicFiles(folderPath: string): Promise<void> {
  // Verify folder exists
  if (!fs.existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
  }

  // Check for token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Error: BLOB_READ_WRITE_TOKEN not found in environment");
    console.error("Make sure it's set in your .env file");
    process.exit(1);
  }

  // Find all supported audio files
  const files = fs.readdirSync(folderPath).filter((f) =>
    SUPPORTED_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))
  );

  if (files.length === 0) {
    console.error(`No audio files found in: ${folderPath}`);
    console.error(`Supported formats: ${SUPPORTED_EXTENSIONS.join(", ")}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} audio files to upload\n`);

  const results: UploadResult[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const ext = path.extname(file).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "audio/mpeg";

    console.log(`Uploading: ${file} (${sizeMB} MB)...`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = await put(`music/${file}`, fileBuffer, {
        access: "public",
        contentType,
      });

      results.push({
        filename: path.basename(file, ext),
        extension: ext,
        url: blob.url,
        size: stats.size,
      });

      console.log(`  ✓ Uploaded: ${blob.url}\n`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ filename: file, error: errorMsg });
      console.error(`  ✗ Failed: ${errorMsg}\n`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("UPLOAD COMPLETE");
  console.log("=".repeat(60));
  console.log(`✓ Successful: ${results.length}`);
  console.log(`✗ Failed: ${errors.length}`);

  if (results.length > 0) {
    console.log("\n--- Track data for database ---\n");

    // Output as JSON for easy use with API
    const trackData = results.map((r) => {
      // Convert filename to a clean name (remove leading numbers, replace underscores)
      const cleanName = r.filename
        .replace(/^\d+\s*/, "") // Remove leading numbers
        .replace(/_/g, " ")     // Replace underscores with spaces
        .trim();

      return {
        filename: r.filename.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        name: cleanName || r.filename,
        artist: "Unknown Artist", // You'll want to update this
        durationMs: 0, // You'll need to get actual duration
        downloadUrl: r.url,
        segments: [], // Add segments later
      };
    });

    console.log(JSON.stringify(trackData, null, 2));

    // Also output SQL UPDATE statements (for existing tracks)
    console.log("\n--- SQL UPDATE statements (for existing tracks) ---\n");
    for (const r of results) {
      console.log(
        `UPDATE music_tracks SET download_url = '${r.url}' WHERE filename = '${r.filename}';`
      );
    }
  }

  if (errors.length > 0) {
    console.log("\n--- Failed uploads ---\n");
    for (const e of errors) {
      console.log(`${e.filename}: ${e.error}`);
    }
  }
}

// Main
const folderPath = process.argv[2];

if (!folderPath) {
  console.log("Usage: npx tsx scripts/upload-music.ts /path/to/music/folder");
  console.log("\nExample:");
  console.log(
    "  npx tsx scripts/upload-music.ts ~/Desktop/fitness_app/apps/tv/android/app/src/main/assets/music"
  );
  process.exit(1);
}

uploadMusicFiles(path.resolve(folderPath));

/**
 * Upload music files to Vercel Blob storage
 *
 * Usage:
 *   cd apps/nextjs
 *   npx tsx scripts/upload-music.ts /path/to/music/folder
 *
 * This script will:
 * 1. Find all .mp3 files in the specified folder
 * 2. Upload each to Vercel Blob under music/{filename}.mp3
 * 3. Output the URLs for updating the database
 */

import { put } from "@vercel/blob";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

interface UploadResult {
  filename: string;
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

  // Find all MP3 files
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".mp3"));

  if (files.length === 0) {
    console.error(`No .mp3 files found in: ${folderPath}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} MP3 files to upload\n`);

  const results: UploadResult[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`Uploading: ${file} (${sizeMB} MB)...`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = await put(`music/${file}`, fileBuffer, {
        access: "public",
        contentType: "audio/mpeg",
      });

      results.push({
        filename: path.basename(file, ".mp3"),
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
    console.log("\n--- URLs for database updates ---\n");

    // Output as JSON for easy copy/paste
    const urlMap = results.map((r) => ({
      filename: r.filename,
      downloadUrl: r.url,
    }));

    console.log(JSON.stringify(urlMap, null, 2));

    // Also output SQL update statements
    console.log("\n--- SQL UPDATE statements ---\n");
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

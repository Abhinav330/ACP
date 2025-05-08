import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: Request) {
  try {
    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Generate unique filename with original extension
    const timestamp = Date.now();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Get file extension from mime type or default to .png
    const mimeType = file.type || 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `${timestamp}.${ext}`;
    
    const filepath = path.join(uploadDir, filename);

    // Save the file
    await writeFile(filepath, buffer);

    // Return the relative URL for the file
    const fileUrl = `/uploads/${filename}`;

    return NextResponse.json({
      url: fileUrl,
      filename: filename
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 
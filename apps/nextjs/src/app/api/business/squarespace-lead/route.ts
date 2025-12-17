import { NextRequest, NextResponse } from 'next/server';

// Environment variables (will be loaded from .env)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SQUARESPACE_API_KEY = process.env.SQUARESPACE_API_KEY;
const SQUARESPACE_FORM_ID = process.env.SQUARESPACE_FORM_ID;

// Type for the lead data
interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

// Type for Squarespace form submission
interface SquarespaceFormSubmission {
  id: string;
  formId: string;
  submittedAt: string;
  data: {
    [key: string]: {
      value: string;
      type: string;
    };
  };
}

// Maximum request size (10KB)
const MAX_REQUEST_SIZE = 10 * 1024;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (!WEBHOOK_SECRET || webhookSecret !== WEBHOOK_SECRET) {
      console.error('Invalid webhook secret');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      console.error('Request body too large');
      return NextResponse.json(
        { success: false, error: 'Request body too large' },
        { status: 413 }
      );
    }

    // 3. Parse request body
    let leadData: LeadData;
    try {
      leadData = await request.json();
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 4. Validate required fields
    if (!leadData.name || !leadData.email) {
      console.error('Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Log the received data (temporary - will be replaced with actual processing)
    console.log('Received lead data:', {
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone || 'Not provided',
      message: leadData.message || 'No message'
    });

    // TODO: Add Google Sheets integration
    // TODO: Add Twilio SMS integration

    // For now, return success
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error in squarespace-lead endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Reject non-POST requests
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}
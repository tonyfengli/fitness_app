import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Test different endpoints
    const responses = {};
    
    // Try the standard get-session endpoint
    const sessionRes = await fetch('http://localhost:3000/api/auth/get-session', {
      headers: {
        'Cookie': 'better-auth.session=your-session-cookie-here' // You'll need to update this
      }
    });
    responses.getSession = await sessionRes.json();
    
    // Try the session endpoint
    const sessionRes2 = await fetch('http://localhost:3000/api/auth/session', {
      headers: {
        'Cookie': 'better-auth.session=your-session-cookie-here' // You'll need to update this
      }
    });
    responses.session = await sessionRes2.json();
    
    return NextResponse.json({
      endpoints: responses,
      note: "Update the cookie value with your actual session cookie"
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
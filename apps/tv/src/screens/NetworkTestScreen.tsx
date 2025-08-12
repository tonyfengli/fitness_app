import React, { useState, useEffect } from 'react';
import { Box, Text, Button } from '../components';

export function NetworkTestScreen() {
  const [status, setStatus] = useState<string>('Testing network...');
  const [details, setDetails] = useState<string>('');

  const testNetwork = async () => {
    setStatus('Testing network...');
    setDetails('');
    
    try {
      // Test 1: Basic fetch to Google
      console.log('Test 1: Fetching from Google...');
      const googleResponse = await fetch('https://www.google.com');
      console.log('Google response status:', googleResponse.status);
      setStatus('Google: OK');
      
      // Test 2: Fetch from Supabase
      console.log('Test 2: Fetching from Supabase...');
      const supabaseUrl = 'https://jrpjnwonyhhdahptxyhm.supabase.co';
      const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpycGpud29ueWhoZGFocHR4eWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzOTIzMDAsImV4cCI6MjA2Njk2ODMwMH0.Q7ND5zKkxhFOFGQm-yUkSKXIL-6AZTDdBxAhXPGRZ3s',
        }
      });
      console.log('Supabase response status:', supabaseResponse.status);
      
      setStatus('Network is working!');
      setDetails(`Google: ${googleResponse.status}, Supabase: ${supabaseResponse.status}`);
    } catch (error: any) {
      console.error('Network test error:', error);
      setStatus('Network Error');
      setDetails(error.message || 'Unknown error');
    }
  };

  useEffect(() => {
    testNetwork();
  }, []);

  return (
    <Box style={{ flex: 1 }} backgroundColor="gray100" padding="xl">
      <Text variant="h1" marginBottom="m">Network Test</Text>
      
      <Box marginBottom="l">
        <Text variant="h3" marginBottom="s">Status: {status}</Text>
        {details !== '' && (
          <Text variant="body" color="textSecondary">{details}</Text>
        )}
      </Box>
      
      <Button variant="primary" onPress={testNetwork}>
        Test Again
      </Button>
    </Box>
  );
}
import { useState, useCallback } from 'react';

export const useStreamingReview = () => {
  const [reviewText, setReviewText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const startStream = useCallback(async (payload) => {
    setReviewText('');
    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch('/api/review/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming the standard API requires x-api-key if needed.
          // Add auth headers if necessary for the specific environment.
          'x-api-key': localStorage.getItem('reposage_api_key') || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream is not supported by your browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.startsWith('data: ')) {
              const dataStr = part.replace(/^data:\s*/, '').trim();
              
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  setReviewText((prev) => prev + parsed.text);
                } else if (parsed.error) {
                  setError(parsed.error);
                  done = true;
                  break;
                }
              } catch (e) {
                console.error('Failed to parse SSE chunk JSON:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred while streaming.');
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { reviewText, isStreaming, error, startStream };
};

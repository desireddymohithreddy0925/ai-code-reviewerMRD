/**
 * Lightweight heuristic PII Redactor for replacing sensitive information
 * (Emails, IP Addresses, Phone Numbers, SSNs/CCs) before transmitting
 * code chunks to third-party LLMs.
 */
export class PiiRedactor {
  static redact(text) {
    if (!text || typeof text !== 'string') return text;
    
    let redacted = text;

    // 1. Redact Emails
    // Exclude common placeholder/example domains if desired, but here we just aggressively redact.
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    redacted = redacted.replace(emailRegex, '<REDACTED_EMAIL>');

    // 2. Redact IPv4 (Avoid loopback 127.0.0.1 and private subnets if strictly necessary, 
    // but the prompt specifies aggressive public IP masking. We'll mask standard IPs)
    const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    redacted = redacted.replace(ipv4Regex, (match) => {
      // Don't redact localhost / loopback
      if (match.startsWith('127.') || match === '0.0.0.0' || match === '255.255.255.255') {
        return match;
      }
      return '<REDACTED_IP>';
    });

    // 3. Redact IPv6
    const ipv6Regex = /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi;
    redacted = redacted.replace(ipv6Regex, (match) => {
      // Basic loopback check for ipv6
      if (match === '0000:0000:0000:0000:0000:0000:0000:0001' || match === '::1') return match;
      return '<REDACTED_IP>';
    });

    // 4. Redact US Phone Numbers
    // Formats: (123) 456-7890 | 123-456-7890 | 123.456.7890 | +1 123 456 7890
    const phoneRegex = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g;
    redacted = redacted.replace(phoneRegex, (match, p1, p2, p3) => {
      // Exclude obvious fake/test numbers if needed, but we'll mask everything
      return '<REDACTED_PHONE>';
    });

    // 5. Redact SSN (Social Security Numbers)
    // Format: AAA-GG-SSSS
    const ssnRegex = /\b(?!000)(?!666)(?!9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
    redacted = redacted.replace(ssnRegex, '<REDACTED_SENSITIVE>');

    // 6. Redact Credit Card Numbers (13-19 digits, optionally separated by spaces or dashes)
    const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
    redacted = redacted.replace(ccRegex, (match) => {
      // Very aggressive, so we verify length of digits
      const digitsOnly = match.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
        return '<REDACTED_SENSITIVE>';
      }
      return match;
    });

    return redacted;
  }
}

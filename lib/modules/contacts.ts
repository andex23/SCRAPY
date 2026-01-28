import { Page } from 'playwright';
import { ContactData } from '@/types';

export async function extractContacts(page: Page): Promise<ContactData> {
  const contacts = await page.evaluate(() => {
    const emails: string[] = [];
    const phones: string[] = [];
    const socials: string[] = [];

    // Get all text content
    const bodyText = document.body.innerText;
    
    // Extract emails with regex
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const emailMatches = bodyText.match(emailRegex);
    if (emailMatches) {
      emailMatches.forEach(email => {
        if (!emails.includes(email) && !email.includes('.png') && !email.includes('.jpg')) {
          emails.push(email);
        }
      });
    }

    // Also check mailto links
    document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
      const email = link.getAttribute('href')?.replace('mailto:', '').split('?')[0];
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    });

    // Extract phone numbers
    const phoneRegex = /(\+?\d[\d\s\-\(\)]{7,}\d)/g;
    const phoneMatches = bodyText.match(phoneRegex);
    if (phoneMatches) {
      phoneMatches.forEach(phone => {
        const cleaned = phone.trim();
        if (cleaned.length >= 8 && !phones.includes(cleaned)) {
          phones.push(cleaned);
        }
      });
    }

    // Check tel links
    document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
      const phone = link.getAttribute('href')?.replace('tel:', '');
      if (phone && !phones.includes(phone)) {
        phones.push(phone);
      }
    });

    // Extract social media links
    const socialDomains = [
      'linkedin.com',
      'instagram.com',
      'twitter.com',
      'x.com',
      'tiktok.com',
      'facebook.com',
      'youtube.com',
      'github.com'
    ];

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      socialDomains.forEach(domain => {
        if (href.includes(domain) && !socials.includes(href)) {
          socials.push(href);
        }
      });
    });

    return { emails, phones, socials };
  });

  // Limit results
  return {
    emails: contacts.emails.slice(0, 20),
    phones: contacts.phones.slice(0, 20),
    socials: contacts.socials.slice(0, 20),
  };
}


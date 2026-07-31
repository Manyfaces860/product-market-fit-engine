import { clerkClient } from '@clerk/nextjs/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface EmailTarget {
  email: string;
  firstName: string;
}

/**
 * Generates the premium, dark-theme responsive HTML template matching P-X1 branding.
 */
function generateEmailHtml(firstName: string, clusterText: string, productName: string, clusterId: string): string {
  // Use public local fallback URL for dev or real domain for production
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const detailLink = `${siteUrl}/cluster/${clusterId}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>P-X1 Problem Solved</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #020617;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .header {
          background: linear-gradient(135deg, #1e1b4b 0%, #030712 100%);
          padding: 40px 30px;
          text-align: center;
          border-bottom: 1px solid #1e293b;
        }
        .header-logo {
          font-family: monospace;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: #f59e0b;
          margin-bottom: 10px;
        }
        .header-title {
          font-size: 26px;
          font-weight: bold;
          margin: 0;
          color: #ffffff;
          letter-spacing: -0.025em;
          font-style: italic;
        }
        .content {
          padding: 40px 30px;
          line-height: 1.6;
        }
        .greeting {
          font-size: 16px;
          color: #e2e8f0;
          margin-top: 0;
        }
        .main-text {
          font-size: 15px;
          color: #94a3b8;
          margin-bottom: 30px;
        }
        .box-frustration {
          background-color: #020617;
          border-left: 3px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .box-frustration-label {
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #f59e0b;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .box-frustration-text {
          font-size: 14px;
          color: #cbd5e1;
          font-style: italic;
          margin: 0;
        }
        .box-solution {
          background-color: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          margin-bottom: 30px;
        }
        .box-solution-title {
          font-size: 18px;
          font-weight: bold;
          color: #38bdf8;
          margin-top: 0;
          margin-bottom: 8px;
        }
        .box-solution-desc {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 20px;
        }
        .btn-cta {
          display: inline-block;
          background: linear-gradient(to right, #f59e0b, #ec4899);
          color: #020617 !important;
          text-decoration: none;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 14px 30px;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.25);
        }
        .footer {
          background-color: #020617;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #1e293b;
        }
        .footer-text {
          font-size: 11px;
          color: #64748b;
          margin: 0 0 10px 0;
          line-height: 1.5;
        }
        .footer-link {
          color: #f59e0b;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Header -->
        <div class="header">
          <div class="header-logo">// P-X1 Discovery Loop</div>
          <h1 class="header-title">A Solution Has Launched!</h1>
        </div>

        <!-- Content Body -->
        <div class="content">
          <p class="greeting">Hi ${firstName},</p>
          <p class="main-text">
            Your voice was heard. A builder inside our community has officially listed a functional, productizable solution to solve the core customer frustration you co-signed:
          </p>

          <!-- The co-signed Problem Cluster -->
          <div class="box-frustration">
            <div class="box-frustration-label">Your Co-signed Frustration</div>
            <p class="box-frustration-text">"${clusterText}"</p>
          </div>

          <!-- The launched Solution -->
          <div class="box-solution">
            <div class="box-solution-title">🚀 ${productName}</div>
            <p class="box-solution-desc">
              This newly listed product claims to address your exact setup bottlenecks. Click below to inspect its features, join the private beta, and read live developer reviews!
            </p>
            <a href="${detailLink}" class="btn-cta">Test Private Beta</a>
          </div>

          <p class="main-text" style="margin-bottom: 0;">
            Thank you for being part of P-X1. By validating real-world pain points, you are helping creators build things that actually matter.
          </p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">
            You received this email because you co-signed a pain point report on the P-X1 engine.
          </p>
          <p class="footer-text">
            <a href="${siteUrl}" class="footer-link">P-X1 Engine</a> &bull; <a href="${siteUrl}/browse" class="footer-link">Browse Opportunities</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

/**
 * Blasts personalized, dark-themed HTML emails to all co-signers of a problem cluster.
 * Leverages the Resend REST API via secure fetch calls.
 */
export async function blastLaunchNotification(
  userIds: string[],
  clusterText: string,
  productName: string,
  clusterId: string
) {
  if (!RESEND_API_KEY) {
    console.warn('[Resilience] RESEND_API_KEY is missing in environmental variables. Skipping notifications.');
    return;
  }

  if (!userIds || userIds.length === 0) {
    console.log('[Notification] No co-signers recorded on this cluster. Skipping email blasts.');
    return;
  }

  try {
    console.log(`[Notification] Initiating Clerk identity lookup for ${userIds.length} co-signers...`);
    const clerk = await clerkClient();

    // Fetch user details from Clerk in parallel
    const userPromises = userIds.map(async (id) => {
      try {
        const user = await clerk.users.getUser(id);
        const email = user.emailAddresses[0]?.emailAddress;
        const firstName = user.firstName || 'Validator';
        if (!email) return null;
        return { email, firstName } as EmailTarget;
      } catch (clerkErr) {
        console.error(`[Clerk] Identity fetch failed for userId: ${id}`, clerkErr);
        return null;
      }
    });

    const targets = (await Promise.all(userPromises)).filter(Boolean) as EmailTarget[];

    if (targets.length === 0) {
      console.warn('[Notification] No valid email addresses retrieved from Clerk. Skipping email blasts.');
      return;
    }

    console.log(`[Notification] Successfully fetched identities. Sending ${targets.length} emails in parallel via Resend...`);

    // Dispatch all personalized emails concurrently using Promise.all!
    // This reduces multi-email execution time to a single, sub-second transaction window.
    await Promise.all(targets.map(async (target) => {
      try {
        const htmlContent = generateEmailHtml(target.firstName, clusterText, productName, clusterId);

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Needboard Discovery Loop <launch@mail.needboard.space>', // 🚀 Your free subdomain sender!
            to: [target.email],
            subject: `[Needboard] A solution has launched for: "${clusterText.substring(0, 35)}..."`,
            html: htmlContent,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[Resend] Email delivery failed for ${target.email}. Status: ${res.status}. Response: ${errBody}`);
        } else {
          console.log(`[Resend] Successfully delivered launch alert to ${target.email}`);
        }
      } catch (sendErr) {
        console.error(`[Resend] Network dispatch error for ${target.email}:`, sendErr);
      }
    }));

    console.log('[Notification] Completed parallel email blast dispatch sequence.');
  } catch (error) {
    console.error('[Notification] Error executing blast launch notifications:', error);
  }
}

/**
 * Direct test function that bypasses Clerk lookup and sends a beautifully styled P-X1 email
 * directly to a target email address for verification.
 */
export async function sendDirectTestEmail(toEmail: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing from environment variables.');
  }

  const htmlContent = generateEmailHtml(
    'Explorer',
    'Local microfrontends take 16GB of RAM and hot reload hot-compilation fails constantly.',
    'DevSync Pro v1.4',
    'cluster_seed_software-devtools'
  );

  console.log(`[Test] Dispatched direct Needboard styled alert to: ${toEmail}...`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Needboard Discovery Loop <launch@mail.needboard.space>', // 🚀 Your custom subdomain sender!
      to: [toEmail],
      subject: `[Needboard Test] A solution has launched for your pain point!`,
      html: htmlContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API returned status ${res.status}: ${body}`);
  }

  console.log(`[Test] Email successfully accepted by Resend! Check your inbox at: ${toEmail}`);
}

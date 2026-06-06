// One-time helper to obtain a Google Calendar refresh token for the app.
//
// Prereqs:
//   1. Create an OAuth 2.0 Client (type: Web application) in Google Cloud
//      Console, with redirect URI:  http://localhost:5555/oauth2callback
//   2. Enable the Google Calendar API for that project.
//   3. Export the client id/secret, then run this script:
//
//        GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npm run google-auth
//
// It prints a GOOGLE_REFRESH_TOKEN — paste that into your .env.local / Vercel.

import http from "node:http";
import { google } from "googleapis";

const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\nOpen this URL in your browser and approve access:\n");
console.log(url + "\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<p>Done — you can close this tab and return to the terminal.</p>");

  try {
    const { tokens } = await oauth2.getToken(code);
    console.log("\n✅  Add this to your environment:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (e) {
    console.error("Token exchange failed:", e);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log(`Waiting for the redirect on ${REDIRECT} ...`);
});

# ♣ Cribbage Multiplayer

A real-time multiplayer cribbage game with private room codes, automatic scoring, and custom rules.

## Project Structure

```
cribbage/
├── server/          ← Node.js WebSocket game server (deploy to Railway)
│   ├── index.js
│   ├── package.json
│   └── railway.toml
└── client/          ← React frontend (deploy to Netlify / Vercel)
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        └── App.jsx
```

---

## Step-by-Step Deployment

### Step 1 — Deploy the Server to Railway (free, ~5 minutes)

Railway runs the WebSocket server and gives you a public URL.

1. Go to https://railway.app and sign up (free, no credit card)
2. Click **"New Project" → "Deploy from GitHub repo"**
   - Push the `server/` folder to a GitHub repo first, OR
   - Use **"Deploy from local"** and drag the `server/` folder
3. Railway auto-detects Node.js and runs `npm start`
4. Once deployed, click your service → **Settings → Networking → Generate Domain**
5. Copy your domain, e.g. `cribbage-server-production.up.railway.app`
6. Your WebSocket URL will be: `wss://cribbage-server-production.up.railway.app`

> Railway free tier: 500 hours/month — plenty for friends playing cribbage.

---

### Step 2 — Configure the Client

Open `client/src/App.jsx` and find line 4:

```js
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
```

You'll set `VITE_WS_URL` as an environment variable when deploying — no code change needed.

---

### Step 3 — Deploy the Client to Netlify (free, ~5 minutes)

1. Go to https://app.netlify.com
2. Click **"Add new site" → "Deploy manually"**
3. First, build the client locally:
   ```bash
   cd client
   npm install
   VITE_WS_URL=wss://YOUR-RAILWAY-URL.up.railway.app npm run build
   ```
4. Drag the `client/dist/` folder onto the Netlify deploy page
5. Your game is live at a Netlify URL like `https://random-name.netlify.app`

**To use a custom domain or subdomain (e.g. `cribbage.yourdomain.com`):**
1. In Netlify: Site settings → Domain management → Add custom domain
2. Enter `cribbage.yourdomain.com`
3. In your domain registrar (GoDaddy, Namecheap, etc.), add a CNAME record:
   - Name: `cribbage`
   - Value: `your-site.netlify.app`
4. Wait ~10 minutes for DNS to propagate

---

### Step 4 — Embed on Your WordPress/Squarespace/Wix Site

**Option A — Simple Link**
Add a button or menu item on your site that links to `https://cribbage.yourdomain.com`.

**Option B — Embedded iframe**
Add an HTML embed block on your site with:
```html
<iframe
  src="https://cribbage.yourdomain.com"
  width="100%"
  height="700"
  style="border: none; border-radius: 12px;"
  allow="clipboard-write"
></iframe>
```
- WordPress: Use the "Custom HTML" block in the block editor
- Squarespace: Add a "Code" block
- Wix: Add an "HTML iframe" element

---

## Local Development

Run both server and client locally:

```bash
# Terminal 1 — Server
cd server
npm install
npm run dev    # starts on ws://localhost:3001

# Terminal 2 — Client
cd client
npm install
npm run dev    # starts on http://localhost:5173
```

---

## How to Play

1. **Host** opens the game and clicks **"Create New Room"**
2. Share the 6-character **room code** with your friend
3. **Friend** enters the code and clicks **"Join Room"**
4. Game starts automatically — cards are dealt, non-dealer goes first

### Game Flow
- **Discard**: Each player selects 2 cards to send to the crib (tap to select, gold = selected)
- **Cut**: Either player cuts the deck to reveal the starter card
- **Pegging**: Take turns playing cards, scoring 15s/pairs/runs in real time
- **Show**: Host clicks "Score Hands" — breakdown shown for each hand and crib
- Next round begins automatically with dealer rotating

### Custom Rules (⚙️)
Only the host can change rules — they sync to both players automatically.
- Adjust points for fifteens, pairs, flush, nobs
- Enable double scoring mode
- Set custom winning score (61, 121, etc.)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Room not found" | Code expired — rooms are deleted when either player disconnects |
| WebSocket won't connect | Check Railway is running; verify `wss://` not `ws://` for production |
| Iframe blocked on site | Some hosts block iframes; use a direct link instead |
| Cards not responding | Refresh — may be a stale connection |

---

## Tech Stack

- **Frontend**: React + Vite (no heavy dependencies)
- **Backend**: Node.js + `ws` (WebSocket library)
- **Hosting**: Railway (server) + Netlify (client)
- **Real-time**: Native WebSockets — no Socket.io needed

# 🇻🇳 Discord VietQR Payment Bot

A Discord bot for Vietnamese banking — generates scannable VietQR codes so customers can pay instantly with any Vietnamese banking app (MoMo, ZaloPay, VietcomBank, MB Bank, etc.).

---

## ✨ Features

| Command | Description |
|---|---|
| `/pay amount:<VND> [note] [customer]` | Generate QR for a custom amount |
| `/booking type:<day\|night> hours:<n> [customer] [note]` | Generate QR based on hourly rate × hours |
| `/rates` | Show current day/night rates |

- 🔒 **Role-gated** — only users with the `support` role can use payment commands
- 🏦 **VietQR standard** — works with all Napas-connected Vietnamese banks
- 🆔 **Auto payment ID** — each QR has a unique `PAY-XXXXXXXX` reference for easy reconciliation
- ☁️ **Cloud-ready** — deploys to Railway / Render / Heroku (always online)

---

## 🚀 Quick Setup

### Step 1 — Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → give it a name (e.g. `VietQR Bot`)
3. Go to **Bot** tab → **Reset Token** → copy the token
4. Enable **`applications.commands`** scope under OAuth2
5. Under **Bot** → enable `Send Messages`, `Embed Links`, `Attach Files` permissions
6. **Invite URL**: `https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=51200&scope=bot+applications.commands`
7. Replace `YOUR_APP_ID` with your Application ID and open the URL to invite the bot

### Step 2 — Get VietQR API Keys (Free)

1. Visit [https://developers.vietqr.io/](https://developers.vietqr.io/)
2. Register a free account
3. Get your `Client-ID` and `API-Key`
4. Find your bank's BIN at [https://api.vietqr.io/v2/banks](https://api.vietqr.io/v2/banks)

**Common Bank BINs:**
| Bank | BIN |
|---|---|
| MB Bank | 970422 |
| Vietcombank | 970436 |
| BIDV | 970418 |
| VPBank | 970432 |
| Techcombank | 970407 |
| Agribank | 970405 |
| ACB | 970416 |

### Step 3 — Configure `.env`

```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token
SUPPORT_ROLE_NAME=support       # Role allowed to use commands

BANK_ID=970422                  # Your bank's BIN
BANK_NAME=MB Bank
BANK_ACCOUNT_NO=0123456789      # Your account number
BANK_ACCOUNT_NAME=NGUYEN VAN A  # Must be UPPERCASE, no accents

VIETQR_CLIENT_ID=your_client_id
VIETQR_API_KEY=your_api_key

RATE_DAY=25000                  # VND per hour (day)
RATE_NIGHT=30000                # VND per hour (night)
```

### Step 4 — Run Locally (for testing)

```bash
npm install
npm start
```

---

## ☁️ Deploy to Railway (Recommended — Free Tier)

Railway keeps your bot running 24/7 even when your PC is off.

1. Push code to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create discord-vietqr-bot --public --push
   ```

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**

3. Select your repo

4. Go to **Variables** tab → add all your `.env` values one by one:
   - `DISCORD_TOKEN`
   - `BANK_ID`, `BANK_NAME`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`
   - `VIETQR_CLIENT_ID`, `VIETQR_API_KEY`
   - `RATE_DAY`, `RATE_NIGHT`
   - `SUPPORT_ROLE_NAME`

5. Railway auto-deploys. Your bot is now always online! ✅

### Alternative: Render.com (also free)

1. [render.com](https://render.com) → New → **Background Worker**
2. Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add environment variables in the dashboard
6. Deploy ✅

---

## 🔐 Discord Server Setup

1. Create a role called **`support`** (or whatever you set in `SUPPORT_ROLE_NAME`)
2. Assign it to staff members who should be allowed to generate payments
3. Users without the role will get an error message

---

## 💡 Usage Examples

**Custom payment:**
```
/pay amount:150000 note:Deposit customer:@JohnDoe
```

**Booking payment:**
```
/booking type:night hours:3 customer:@JohnDoe
→ Total: 30,000 × 3 = 90,000 ₫
```

**Check rates:**
```
/rates
```

### What the QR embed shows:
- ✅ Scannable QR image (works with Vietcombank, MB Bank, MoMo, ZaloPay, etc.)
- 🆔 Unique Payment ID (e.g. `PAY-3F9A12CC`)
- 💰 Total amount in VND
- 📝 Transfer description to paste/match (e.g. `PAY-3F9A12CC NIGHT 3H`)
- 🏦 Bank name, account name, account number

---

## 📁 Project Structure

```
discord-vietqr-bot/
├── index.js              # Bot entry point, command loader, role guard
├── commands/
│   ├── pay.js            # /pay — custom amount
│   ├── booking.js        # /booking — day/night × hours
│   └── rates.js          # /rates — show current rates
├── utils/
│   ├── vietqr.js         # VietQR API integration
│   └── helpers.js        # Payment ID, formatting, rate calc
├── .env.example          # Config template
├── package.json
├── railway.toml          # Railway deployment config
└── Procfile              # Heroku/Render compatibility
```

---

## 🛠 Customization

**Change rates at any time** — just update `RATE_DAY` and `RATE_NIGHT` in your Railway environment variables and redeploy (one click).

**Add more booking types** — edit `commands/booking.js` and add more `.addChoices()` entries with their own rate env vars.

**Multiple banks** — you can extend `/booking` to accept a bank selection if needed.

---

## 📞 Support

- VietQR docs: [https://developers.vietqr.io/](https://developers.vietqr.io/)
- Discord.js docs: [https://discord.js.org/](https://discord.js.org/)
- Bank BIN list: [https://api.vietqr.io/v2/banks](https://api.vietqr.io/v2/banks)

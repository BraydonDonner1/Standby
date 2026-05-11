# Standby

A cue light system for live production. Performers open a web page on their phone and see their cue state in full screen. The operator uses a **Stream Deck** (via Bitfocus Companion) or the web **Console** to fire cues in real time — no native app installs required.

Standby ships as a **macOS menu-bar app** built with Electron. The embedded Node server runs silently in the background; a tray icon gives you one-click access to the console, the performer URL, and server controls.

---

## Requirements

- **macOS** (for the Electron app) — or any platform running **Node.js 18+** for the bare server
- **Bitfocus Companion 3.x** — for Stream Deck integration (uses the included custom module)
- All devices (server, phones, Stream Deck computer) must be on the **same local network**

---

## Quick Start — Electron App

```bash
git clone <repo-url> standby
cd standby
cp config.example.json config.json   # edit channel names to match your production
npm install
npm run electron
```

A **Standby** icon appears in the macOS menu bar. Click it for options:

| Menu item | What it does |
|-----------|-------------|
| Open Console | Opens the operator console window |
| Copy Performer URL | Copies `http://localhost:3000/` to the clipboard |
| Restart Server | Stops and restarts the embedded server |
| Quit Standby | Shuts down the server and exits |

> **Building a distributable .app**
>
> ```bash
> npm run build:mac
> ```
>
> This uses `electron-builder` to produce a DMG installer for both Apple Silicon and Intel Macs.
> Before building, supply a 1024×1024 `electron/assets/icon.icns` file (macOS app icon).
> The `dist/` folder is gitignored — never commit it.

---

## Quick Start — Bare Node Server

If you don't need the Electron wrapper (e.g. on Linux or a headless server):

```bash
npm start
```

Output:

```
[INFO]  Initialized 8 channels
[INFO]  WebSocket server attached to HTTP server
[INFO]  Standby server running on port 3000
[INFO]  Web client: http://localhost:3000/
[INFO]  Console:    http://localhost:3000/console.html
```

Suppress info output (e.g. in a systemd unit):

```bash
LOG_LEVEL=silent npm start
```

---

## Configuration

Copy `config.example.json` to `config.json` (gitignored — never committed) and edit it:

```json
{
  "channels": [
    "Host",
    "Lights",
    "FOH",
    "Monitor",
    "Band A",
    "Video",
    "Keys",
    "Drums"
  ],
  "port": 3000
}
```

- Add or remove names to match your crew.
- Channel IDs are zero-indexed: first entry = `0`, second = `1`, etc.
- Defaults to 8 channels named "Channel 1–8" on port 3000 if `config.json` is missing.
- **Channels can also be edited live** via the Settings drawer in the console — no restart needed.

---

## Performer Client

Open a browser on any phone or tablet on the same network:

```
http://<server-ip>:3000/
```

1. Select a channel from the drop-down and tap **Connect**.
2. The screen shows the cue state in full color:

| State | Color |
|-------|-------|
| CLEAR | Dark / neutral |
| STANDBY | Amber |
| GO | Bright green |

3. When a STANDBY cue fires, an **I'm Ready** button appears. Tapping it sends an acknowledgement back to the console so the operator can see who is ready.
4. If the connection drops, the performer sees "Reconnecting…" and the client automatically reconnects — no manual refresh needed.

---

## Operator Console

```
http://<server-ip>:3000/console.html
```

(In the Electron app, **Open Console** in the menu bar opens this as a native window.)

### Channel cards

Each channel shows its current state and three buttons — STANDBY, GO, CLEAR — plus a ✓ READY badge when the performer has acknowledged.

### Batch actions

Check the box on any cards to select them, then use the batch bar that slides up from the bottom:

- **STANDBY ALL / GO ALL / CLEAR ALL** — sets all selected channels at once
- **Deselect** — clears the selection

### Settings drawer

Click **⚙ Settings** to open the settings panel:

- **Channels** — rename, reorder, add, or remove channels. Saving resets all cue states to CLEAR and immediately broadcasts the new channel list to all connected clients.
- **Background Image** — upload a JPEG, PNG, WebP, or GIF to use as a background on all connected performer screens. Remove it to return to the default animated gradient.

---

## Companion Module (Stream Deck Integration)

A custom Bitfocus Companion module lives in `companion-module/`. It provides native actions, feedbacks, and variables for full Stream Deck integration.

### Installing the module

Follow the [Companion developer docs](https://github.com/bitfocus/companion-module-base) to load a local module:

1. Copy (or symlink) the `companion-module/` folder into Companion's module directory.
2. Restart Companion.
3. In **Connections → Add connection**, search for **Standby Cue Light** and add it.
4. Set **Host** to your server's IP address and **Port** to `3000`, then save.

### Actions

| Action | Description |
|--------|-------------|
| Set channel state | Set one channel to `standby`, `go`, or `clear` |
| Set multiple channels | Set a comma-separated list of channel IDs to the same state |
| Clear all channels | Reset every channel to `clear` |

### Feedbacks

| Feedback | Description |
|----------|-------------|
| Channel state | Button color tracks live cue state (clear / standby / standby+acked / go) |
| Channel acknowledged | True when the performer has tapped "I'm Ready" |

### Variables

Variables follow the Companion format `$(connection-id:variable_id)`. With the default connection ID `crchurch-standby` and channel index `N`:

| Variable | Description |
|----------|-------------|
| `$(crchurch-standby:channel_N_state)` | Current state of channel N (`clear` / `standby` / `go`) |
| `$(crchurch-standby:channel_N_name)` | Name of channel N |
| `$(crchurch-standby:channel_N_acked)` | Whether channel N is acknowledged (`yes` / `no`) |

---

## HTTP API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/state` | Full state of all channels |
| POST | `/cue/:id/:action` | Set one channel (`standby` / `go` / `clear`) |
| POST | `/all/clear` | Clear every channel |
| POST | `/cue/batch` | Set multiple channels at once (JSON body: `{ids:[…], action:"…"}`) |
| POST | `/ack/:id` | Performer acknowledgement for channel |
| GET | `/config` | Current channel config (names array) |
| POST | `/config/channels` | Update channel names (body: `{channels:[…]}`) |
| GET | `/background` | Current background image metadata |
| POST | `/background` | Upload a new background (raw image body, `Content-Type` header required) |
| DELETE | `/background` | Remove background image |
| GET | `/health` | Liveness check + uptime in seconds |

**Examples:**

```bash
# Check health
curl http://localhost:3000/health

# Get all channel states
curl http://localhost:3000/state

# Set channel 0 to standby
curl -X POST http://localhost:3000/cue/0/standby

# Batch standby channels 0 and 2
curl -X POST http://localhost:3000/cue/batch \
  -H 'Content-Type: application/json' \
  -d '{"ids":[0,2],"action":"standby"}'

# Clear everything
curl -X POST http://localhost:3000/all/clear
```

---

## Project Structure

```
standby/
├── electron/
│   ├── main.js              # Electron entry — menu bar + server lifecycle
│   └── assets/
│       ├── tray-icon.png    # 16×16 tray icon
│       ├── tray-icon@2x.png # 32×32 retina tray icon
│       └── icon.icns        # macOS app icon
├── server/
│   ├── index.js             # Express + WebSocket wiring
│   ├── api.js               # REST routes
│   ├── state.js             # In-memory channel state
│   ├── websocket.js         # WebSocket broadcast layer
│   ├── config.js            # config.json loader
│   ├── uploads.js           # Background image upload/delete
│   └── logger.js            # Thin stdout/stderr logger
├── client/
│   ├── index.html           # Performer cue screen
│   ├── console.html         # Operator console
│   ├── assets/              # Logos and static assets
│   └── uploads/             # Runtime background image storage (gitignored)
├── companion-module/
│   ├── src/
│   │   ├── main.js          # Module entry point
│   │   ├── actions.js
│   │   ├── feedbacks.js
│   │   ├── variables.js
│   │   └── presets.js
│   └── companion/
│       └── manifest.json
├── config.example.json      # Template — copy to config.json and edit
├── config.json              # YOUR local config (gitignored)
├── package.json
└── LICENSE                  # MIT
```

---

## Troubleshooting

**Phones can't reach the server**
- Make sure you're using the server machine's **local IP**, not `localhost`.
- Mac: System Settings → Network → your active connection → IP address.
- Check that the firewall allows inbound on port 3000: System Settings → Network → Firewall.

**Companion buttons do nothing**
- Confirm the module's **Server URL** has no trailing slash: `http://192.168.1.42:3000`
- Check Companion's connection log for errors.
- Test the endpoint with `curl -X POST http://<ip>:3000/cue/0/standby`.

**Channel names are wrong after editing config.json**
- Use the **Settings drawer** in the console to rename channels live, or restart the server after editing `config.json` (it only reads the file at startup).

**Port 3000 is already in use**
- Change `"port"` in `config.json` and restart.
- Find the conflicting process: `lsof -i :3000`

**Console window won't drag (Electron)**
- The header is the drag region. Clicking buttons or the status indicator is intentional — those are marked `no-drag` so they remain clickable.

---

## License

MIT — see [LICENSE](LICENSE).

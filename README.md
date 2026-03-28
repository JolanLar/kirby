# 🌟 Kirby: Automated Media Purger

<p align="center">
  <img src="docs/assets/dashboard.png" alt="Kirby Dashboard" width="800"/>
</p>

Kirby is a powerful, centralized deletion and exclusion manager designed for sophisticated home media setups. It natively interfaces with **Plex**, **Jellyfin**, **Radarr**, **Sonarr**, and **qBittorrent** to help you keep your storage limits in check without lifting a finger.

---

## ✨ Features

- **Automated Deletion Queue:** Keeps track of your unwatched or older media and intelligently purges it once designated storage thresholds are met.
- **Smart Shield (Auto-Exclusions):** Tracks the deletion history of your library natively. If a movie or series hits your custom threshold of deletions over time, Kirby safely locks it away into the **Exclusions** list to prevent future re-deletions automatically.
- **Favorite Detection:** Automatically detects media favorited by Plex and Jellyfin users and excludes it from deletion. Supports per-user targeting, cross-server aggregation, and an "Ignore" override for individual items.
- **Multi-Server Ready:** Easily toggle paths and storage mapping across Plex and Jellyfin arrays.
- **Authentication:** Built-in username/password login with secure JWT sessions. Supports SSO via any OIDC-compatible provider (Authentik, Keycloak, Auth0, Authelia, …).
- **Dynamic Frontend:** Built with React & Vite + Tailwind, giving you native searching, filtering, sorting, and rapid pagination across all tabs.

---

## 🐳 Docker Deployment

The easiest way to run Kirby is via Docker Compose.

```yaml
services:
  kirby:
    image: jolanl/kirby:latest
    container_name: kirby
    restart: unless-stopped
    ports:
      - "4000:4000"
    volumes:
      - ./config:/app/backend/data
    environment:
      - TZ=Europe/Paris
```

```bash
docker-compose up -d
```

Kirby will be available at `http://localhost:4000`.

On first visit you will be prompted to create an admin account.

---

## 🔐 Authentication

### Username / Password

On first run, navigate to `http://localhost:4000` and create your admin credentials. You can update them later in **Settings → Security**.

### SSO / OAuth2 (OIDC)

Kirby supports any OIDC-compatible identity provider. Configure it in **Settings → SSO / OAuth2**.

| Field | Description |
|---|---|
| **Issuer URL** | Base URL of your provider — Kirby appends `/.well-known/openid-configuration` |
| **Client ID** | The application/client ID registered in your provider |
| **Client Secret** | Client secret (required for confidential clients) |
| **Scopes** | Space-separated scopes — default: `openid profile email` |
| **Redirect URI override** | Leave empty; auto-derived from request headers (supports `X-Forwarded-Proto` / `X-Forwarded-Host`) |

**Issuer URL examples:**

| Provider | Issuer URL |
|---|---|
| Authentik | `https://auth.example.com/application/o/<app-slug>` |
| Keycloak | `https://keycloak.example.com/realms/<realm>` |
| Auth0 | `https://<tenant>.auth0.com` |
| Authelia | `https://auth.example.com` |

Register `https://<your-kirby-host>/api/auth/oauth/callback` as the redirect URI in your provider.

Use the **Test Connection** button in Settings to verify the discovery document is reachable before saving.

---

## 📸 Screenshots

### 🖼️ Exclusions

Visualize and manage your shielded media. Filter by items caught by the automatic shield rules.

<p align="center">
  <img src="docs/assets/exclusions.png" alt="Exclusions" width="800"/>
</p>

### ❤️ Favorites

Browse all media favorited across your Plex and Jellyfin servers. Source badges identify where each favorite originates. Hover any item to toggle its protection — "Ignore" re-enters it in the deletion queue, "Restore" re-enables the shield.

<p align="center">
  <img src="docs/assets/favorites.png" alt="Favorites" width="800"/>
</p>

### ⚙️ Settings

Connect everything from one place. Set free-space targets, service credentials, automation rules, and SSO configuration.

<p align="center">
  <img src="docs/assets/settings.png" alt="Settings" width="800"/>
</p>
<p align="center">
  <img src="docs/assets/settings2.png" alt="Settings" width="800"/>
</p>

---

## 🚀 Local Development

**Prerequisites:** Node.js v18+

```bash
# Install dependencies
npm install --prefix backend
npm install --prefix frontend

# Start backend (port 4000)
npm run dev --prefix backend

# Start frontend (port 5173)
npm run dev --prefix frontend
```

Or use the convenience script:

```bash
./start.sh
```

The frontend dev server proxies `/api` requests to the backend at `localhost:4000`.

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, jsonwebtoken, bcryptjs
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide
- **Auth:** JWT (httpOnly cookies) + OIDC Authorization Code Flow with PKCE
- **Integrations:** Plex, Jellyfin, Radarr, Sonarr, qBittorrent

---

<p align="center">
  Made with ❤️ for Homelab Enthusiasts.
</p>

# Hidden Five

Online multiplayer tile-deduction game for 2 to 4 players. Static page plus one serverless
function. Rooms live in an Upstash Redis database and expire after 24 hours.

```
public/index.html   the game
api/room.js         read and write a room (Vercel serverless function)
package.json
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel choose **Add New > Project**, import the repository, framework preset **Other**,
   leave build settings empty, and deploy. (The first deploy loads, but creating a room fails
   until step 3.)
3. In the project open **Storage > Create Database (or Marketplace) > Upstash Redis**, pick the
   free plan, and connect it to this project for all environments. Vercel adds the variables
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **Deployments > Redeploy** so the function sees the new variables.

Open your project URL, create a room, and send friends the four-letter code.

## Run locally

```
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

## Notes

- Clients poll `/api/room` about once a second while the tab is visible.
- All tiles are stored in the room record, so anyone inspecting network traffic can see their own
  hand. Fine for friends, not for competitive play.
- Unofficial. The mechanics follow the deduction game Got Five! by Yoann Levet (Blue Orange).

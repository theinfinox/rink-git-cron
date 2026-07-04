# Universal Hosting Instructions

The RINK Sync Engine (`rink-git-cron`) has been architected as a "Universal" backend. It bridges the gap between static hosting and traditional server environments by including a built-in Express server and Cron scheduler (`server.js`). 

You can host this project on virtually any platform. Below are the instructions for the three most common hosting architectures.

---

## 1. Vercel (Stateless / Serverless)
Vercel is great for free, global CDN delivery. Because Vercel containers are ephemeral and read-only in production, we do not use `server.js` here. Instead, we rely on Vercel's build phase to generate the data, and GitHub Actions to trigger updates.

**Setup Instructions:**
1. Connect your GitHub repository to a new Vercel project.
2. Set the **Build Command** to: `npm run sync && npm run download-images`
3. Set the **Output Directory** to: `public`
4. Add a GitHub Action (Cron Job) that sends a Deploy Hook to Vercel every hour to rebuild the site with fresh Google Sheet data.

*Note: Vercel completely ignores `server.js` and simply serves your `public` folder globally.*

---

## 2. Docker (Containerized)
Docker is perfect if you want to deploy to AWS, DigitalOcean, or a self-hosted server cluster. 

**Setup Instructions:**
1. A production-ready `docker-compose.yml` and `Dockerfile` are already included in the repository.
2. The `docker-compose.yml` is pre-configured with named volumes (`rink-public-data`) to guarantee that your JSON and image downloads survive any container restarts or server crashes.
3. Simply run:
   ```bash
   docker-compose up -d --build
   ```

*Note: The container will immediately start serving files on port 3000. It will instantly run a full data sync on boot to generate the initial JSON files, and then the internal Node Cron will automatically pull new Google Sheets data every hour.*

---

## 3. PM2 / VPS (Bare Metal Linux)
PM2 is the easiest way to run the project on a traditional Virtual Private Server (VPS) like an AWS EC2 instance. It runs directly on the Linux hard drive, so you don't have to worry about ephemeral storage wiping out your images.

**Setup Instructions:**
1. Clone the repository to your server and install dependencies:
   ```bash
   git clone <your-repo-url>
   cd rink-git-cron
   npm install
   ```
2. Install PM2 globally if you haven't already:
   ```bash
   npm install -g pm2
   ```
3. Start the universal adapter using PM2:
   ```bash
   pm2 start server.js --name "rink-sync-engine"
   ```
4. Save the PM2 process so it restarts if your Linux server reboots:
   ```bash
   pm2 save
   pm2 startup
   ```

*Note: The server will run in the background on port 3000. PM2 will keep it alive forever, and the internal Node Cron will fetch new data every hour.*

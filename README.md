# Claudable (Cloud-Native SaaS Edition)

<div align="center">
<h3>Connect CLI Agent • Build what you want • Deploy instantly</h3>
</div>

<p align="center">
<a href="https://github.com/hesreallyhim/awesome-claude-code">
<img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome Claude Code">
</a>
<a href="https://discord.gg/NJNbafHNQC">
<img src="https://img.shields.io/badge/Discord-Join%20Community-7289da?style=flat&logo=discord&logoColor=white" alt="Join Discord Community">
</a>
</p>

---

> [!IMPORTANT]
> **Project Notice & SaaS Evolution**
>
> This repository is a fork and major architecture extension of the open-source project **[Claudable](https://github.com/opactorai/Claudable)** by **[opactorai](https://github.com/opactorai)**. 
> 
> We have evolved Claudable from a local desktop-bound app into a fully **cloud-native, multi-user SaaS platform**. The execution engine runs AI agents in securely sandboxed Docker workspace containers, persisting credentials, project records, and archives to **Supabase Cloud**.

---

## 🚀 The SaaS Architecture

Claudable SaaS uses a **Sibling Container Orchestration** architecture to handle untrusted AI code execution safely:

```mermaid
graph TD
  User["User Web Browser"] <-->|HTTP / WebSockets| Orchestrator["Next.js Orchestrator (Docker Container)"]
  Orchestrator <-->|"/var/run/docker.sock"| DockerDaemon["Host Docker Daemon"]
  DockerDaemon <-->|Spawns & Manages| Workspaces["Sibling Workspace Containers (claudable-ws-*)"]
  Workspaces <--->|Bind Mounts Projects| HostDisk[("Host File Storage")]
  Orchestrator <-->|Credentials / Projects / Files| Supabase[("Supabase Cloud (DB & Storage)")]
```

---

## 🔥 Key SaaS Features

- 🔒 **Isolated Workspace Sandboxes**: Spawns independent Docker containers (`claudable-workspace:latest` based on Node 20) running `@anthropic-ai/claude-code` for each user project. Your host system is 100% protected from code execution side effects.
- ⚡ **Dynamic Dev Previews**: Code previews run inside the workspace containers (`npm run dev`) and map dynamically to safe host ports (`3100-3200`) proxying to the browser.
- 💾 **Supabase Database & Auth**: Replaced local SQLite databases with a PostgreSQL schema hosted on Supabase, supporting remote user registrations and state tracking.
- 📥 **One-Click Cloud Export**: Real-time compression engine compiles workspace files into `.tar.gz` archives, registers them in the database, uploads them to Supabase Storage, and issues signed download URLs.
- ⏳ **Automated Idle Sweeper**: Background interval sweeping checks container activities, shutting down and cleaning up containers idle for over 30 minutes to save server port and memory footprint.
- 🐳 **Docker-Compose Ready**: Production-grade configurations linking Next.js orchestrators directly to host daemons for rapid single-command deployments.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (React 19, TypeScript)
- **Database / ORM**: PostgreSQL via Supabase Cloud, mapped using Prisma ORM
- **File Storage**: Supabase Storage Buckets
- **Containerization**: Docker (Docker-in-Docker socket proxying)

---

## 📦 Prerequisites

Ensure you have the following installed on your host machine:
- Node.js 20+
- Docker Desktop (ensure it is running)
- Supabase account (for database schemas and storage buckets)

---

## 💻 Local Quick Start (Development)

To run the orchestrator server locally on your host machine:

### 1. Clone the Repository
```bash
git clone https://github.com/opactorai/Claudable.git
cd Claudable
```

### 2. Configure Environment Variables
Copy `.env.local.example` or create a `.env` file in the root directory:
```env
# Next.js Server Configurations
PORT=3000
WEB_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Docker Preview Port Ranges
PREVIEW_PORT_START=3100
PREVIEW_PORT_END=3200

# Supabase Configurations
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Prisma Database Connections
DATABASE_URL="postgresql://postgres:your-db-pass@aws-pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:your-db-pass@aws.supabase.com:5432/postgres"

# Encryption Key (32-byte hex string)
ENCRYPTION_KEY="your-32-byte-hex-encryption-key"

# Anthropic Claude API Key (optional fallback)
ANTHROPIC_API_KEY="your-anthropic-key"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build Workspace Base Image
Build the workspace container image that will be spawned for user projects:
```bash
docker build -t claudable-workspace:latest -f docker/Dockerfile.workspace .
```

### 5. Setup Database Schemas
Push your Prisma schema to your Supabase PostgreSQL instance:
```bash
npx prisma db push
```

### 6. Launch Development Server
```bash
npm run dev
```
Open `http://localhost:3000` to start creating workspaces!

---

## 🐳 Production Deployment (Docker Compose)

To run both the orchestrator and dynamic workspace containers fully inside Docker:

1. In your `.env` file, configure `HOST_PROJECTS_DIR` to point to the absolute path of your project folders on your host system:
   ```env
   # Example for Windows:
   HOST_PROJECTS_DIR="C:\NEW\PROGRAMMING\PROJECTS\Claudable\data\projects"
   
   # Example for Linux / AWS EC2:
   HOST_PROJECTS_DIR="/home/ubuntu/Claudable/data/projects"
   ```
2. Build and launch the container cluster:
   ```bash
   docker compose up -d --build
   ```
This starts the `claudable-orchestrator` container, linking it to the `/var/run/docker.sock` socket to command sibling workspace creations dynamically!

---

## 🛡️ License

MIT License.

# DataStorage

A modern, self-hosted cloud storage and media viewing solution built with **React**, **Node.js**, and **PostgreSQL**.

DataStorage is a personal cloud storage platform inspired by services like Google Drive. It stores physical files in a flat directory while managing all file metadata and virtual folder structures through PostgreSQL. This design removes operating system path limitations and allows virtually unlimited folder nesting.

Supports **Windows**, **Linux**, and **macOS**.

---

## Features

* **Infinite Virtual Folders**

  * Create unlimited virtual folder hierarchies without being constrained by operating system path length limits.

* **In-Browser Media Viewer**

  * View images (`.jpg`, `.png`)
  * Watch videos (`.mp4`)
  * Read PDF documents (`.pdf`)
  * No download required.

* **Smart File Storage**

  * Physical files are stored in a flat directory.
  * PostgreSQL maintains all virtual paths and metadata.

* **Soft Deletion**

  * Deleted files are moved to a virtual Trash instead of being permanently removed.

* **Remote Access**

  * Securely access your storage from anywhere using Tailscale without port forwarding.

* **Containerized Deployment**

  * Complete Docker Compose setup for the frontend, backend, and database.

---

# Technology Stack

| Component        | Technology                |
| ---------------- | ------------------------- |
| Frontend         | React, Vite, Tailwind CSS |
| Backend          | Node.js, Express          |
| Database         | PostgreSQL                |
| File Upload      | Multer                    |
| Containerization | Docker, Docker Compose    |

---

# Quick Start

> No local installation of Node.js, PostgreSQL, or Vite is required.
> Docker handles the complete setup.

## Requirements

| Software       | Version |
| -------------- | ------- |
| Docker         | Latest  |
| Docker Compose | Latest  |
| Git            | Latest  |

---

## Install Docker

### Linux (Arch / CachyOS)

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### Windows / macOS

Download Docker Desktop:

https://www.docker.com/products/docker-desktop

---

## Clone the Repository

```bash
git clone https://github.com/abhiram086/DataStorage.git
cd DataStorage
```

---

## Configure Permissions (Linux Only)

Docker requires write permission for the uploads directory.

```bash
chmod 777 backend/uploads
```

---

## Start the Application

```bash
docker compose up -d --build
```

Open your browser and navigate to:

```text
http://localhost:5174
```

---

# Remote Access with Tailscale

Tailscale enables secure access to your personal cloud from any device without requiring port forwarding.

## Install Tailscale (Arch / CachyOS)

```bash
sudo pacman -S tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up
```

Authenticate using the URL displayed in the terminal.

---

## Retrieve Your Tailscale IP Address

```bash
tailscale ip -4
```

Example output:

```text
100.x.x.x
```

---

## Connect Client Devices

1. Install Tailscale on your phone or another computer.
2. Sign in using the same account.
3. Open:

```text
http://100.x.x.x:5174
```

Your storage server is now securely accessible from anywhere.

---

# Docker Commands

Start all services:

```bash
docker compose up -d
```

View backend logs:

```bash
docker logs -f datastorage-backend
```

Stop all services:

```bash
docker compose down
```

Rebuild after updating the repository:

```bash
docker compose up -d --build
```

---

# Database Management

PostgreSQL runs inside Docker and persists data using Docker volumes.

## Connect to PostgreSQL

```bash
docker exec -it datastorage-db psql -U postgres -d datastorage
```

Useful commands:

```sql
\dt
\d files
SELECT * FROM files;
\q
```

---

## Execute One-Line Queries

Display all tracked files:

```bash
docker exec -it datastorage-db \
psql -U postgres -d datastorage \
-c "SELECT name, folder_path, is_directory FROM files;"
```

Display files currently in the virtual Trash:

```bash
docker exec -it datastorage-db \
psql -U postgres -d datastorage \
-c "SELECT name FROM files WHERE in_trash = true;"
```

---

## Reset the Database

> **Warning**
>
> This removes all database metadata. Physical files inside `backend/uploads` remain intact.

```bash
docker compose down -v
docker compose up -d
```

---

# Project Structure

```text
DataStorage/
├── backend/
│   ├── uploads/           Physical file storage
│   ├── db.js              PostgreSQL initialization
│   ├── server.js          Express API
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

# Troubleshooting

### Upload Permission Denied

Docker cannot write to the uploads directory.

```bash
chmod 777 backend/uploads
```

---

### Database Connection Timeout

During the initial startup, PostgreSQL may still be initializing.

Restart the backend container:

```bash
docker restart datastorage-backend
```

---

### UI Changes Are Not Visible

Your browser may be serving cached static files.

Perform a hard refresh:

```text
Ctrl + Shift + R
```

---

### Port Already in Use

Modify the frontend port mapping in `docker-compose.yml`.

```yaml
ports:
  - "8080:80"
```

The application will then be available at:

```text
http://localhost:8080
```

---

# License

This project is released for educational purposes.

---

# Author

**Abhiram S**

GitHub: https://github.com/abhiram086

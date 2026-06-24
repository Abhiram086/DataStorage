DataStorage (Self-Hosted Cloud)

A modern, high-performance, self-hosted cloud storage solution built with React, Node.js, and PostgreSQL. It abstracts physical file paths using a relational database to provide infinite virtual folder nesting, instant metadata lookups, and robust file management.

Architecture

Frontend: React (Vite) + Tailwind CSS

Backend: Node.js (Express) + Multer

Database: PostgreSQL

Deployment: Fully Dockerized

Prerequisites

Docker and Docker Compose installed on the host machine.

Quick Start (Docker)

Clone the repository:

git clone [https://github.com/abhiram086/DataStorage.git](https://github.com/abhiram086/DataStorage.git)
cd DataStorage


Start the application using Docker Compose:

docker compose up -d --build


Access the application:

Frontend UI: Open http://<YOUR_DEVICE_IP>:5174 in any browser.

Backend API: Runs internally on port 3001.

Storage Handling

Physical files are saved into a flat, sanitized structure in ./backend/uploads. The visual folder hierarchy and metadata are entirely maintained by the PostgreSQL database. Do not manually manipulate files inside the uploads directory.
# VaultSearch 🔒

> **Private, Local, Offline RAG (Retrieval Augmented Generation).**
> Chat with your sensitive documents without data ever leaving your machine.

<img width="1920" height="1080" alt="Screenshot 2026-01-06 015748" src="https://github.com/user-attachments/assets/e276f663-81c6-41f6-ae4b-3e73a16c3580" />

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-compose-ready-green)
![Version](https://img.shields.io/badge/version-1.1.0-purple)

## 🌟 New in v1.1.0: The Cinematic Update
* **Cinematic UI:** Complete frontend overhaul with "Aurora" ambient effects, glassmorphism cards, and interactive hover states.
* **Active Streaming:** Custom React hooks to handle high-velocity token streaming without UI jitter.
* **Robust "Dragnet" Search:** Backend logic is now structure-agnostic, capable of finding and deleting document vectors regardless of nested metadata schema.
* **Smart Context:** Visual "Thinking..." indicators and instant Stop generation controls.

## 🏗 Architecture
* **Brain:** Llama 3 (via Ollama)
* **Memory:** Qdrant (Vector Database) with Self-Healing Volume Logic
* **Backend:** FastAPI + LangChain (Crash-proof startup)
* **Frontend:** Next.js 14 + Tailwind (Glassmorphism UI)

## 🚀 Quick Start

### Prerequisites
1.  **Docker Desktop** (Running)
2.  **Ollama** (Running locally on port 11434)
    * `ollama run llama3`

### Installation

#### 1. Clone the repo
```bash
git clone [https://github.com/vadhh/vaultsearch.git](https://github.com/vadhh/vaultsearch.git)
cd vaultsearch
```
#### 2. Launch the stack
```bash
docker-compose up --build
Open http://localhost:3000.
```

### Usage
- Upload a PDF via the "Knowledge Base" sidebar.

- Ask questions.

- The system will strictly cite sources and page numbers.

## 📦 Release History
v1.1.0 - UI Overhaul, Robust "Dragnet" Delete Logic, Stop Button.

v1.0.0 - Initial Release. Dockerized RAG pipeline.

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first.

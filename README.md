# VaultSearch 🔒

> **Private, Local, Offline RAG (Retrieval Augmented Generation).**
> Chat with your sensitive documents without data ever leaving your machine.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-compose-ready-green)

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/88fd5192-6ff6-4769-ac9d-f31743360091" />


## 🏗 Architecture
* **Brain:** Llama 3 (via Ollama)
* **Memory:** Qdrant (Vector Database)
* **Backend:** FastAPI + LangChain
* **Frontend:** Next.js 14 + Tailwind (Glassmorphism UI)

## 🚀 Quick Start

### Prerequisites
1.  **Docker Desktop** (Running)
2.  **Ollama** (Running locally on port 11434)
    * `ollama run llama3`

### Installation
```bash
# 1. Clone the repo
git clone [https://github.com/YOUR_USERNAME/vaultsearch.git](https://github.com/YOUR_USERNAME/vaultsearch.git)
cd vaultsearch

# 2. Launch the stack
docker-compose up --build
```
### Usage
1. Open http://localhost:3000.

2. Upload a PDF via the sidebar.

3. Ask questions.

    -The system will strictly cite sources and page numbers.

### 📦 Release History
v1.0.0 - Initial Public Release. Full streaming support, citations, and Dockerized deployment.

### 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first.

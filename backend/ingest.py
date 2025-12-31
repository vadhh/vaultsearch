import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models

# --- Configuration ---
PDF_PATH = "sample_regulation.pdf"  # We will create this file next
COLLECTION_NAME = "vault_documents"
QDRANT_URL = "http://localhost:6333"

def main():
    print(f"🔄 Starting ingestion for: {PDF_PATH}")
    
    # 1. Load the PDF
    if not os.path.exists(PDF_PATH):
        print(f"❌ Error: File {PDF_PATH} not found.")
        return

    loader = PyPDFLoader(PDF_PATH)
    documents = loader.load()
    print(f"✅ Loaded {len(documents)} pages.")

    # 2. Split Text (The Art of Chunking)
    # 500 chars is roughly a paragraph. 50 overlap ensures context isn't lost at the cut.
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunks = text_splitter.split_documents(documents)
    print(f"✅ Split into {len(chunks)} text chunks.")

    # 3. Initialize Embedding Model (Local)
    # "all-MiniLM-L6-v2" is fast and effective for English technical text.
    print("🔄 Loading embedding model (this downloads ~80MB on first run)...")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # 4. Connect to Qdrant
    client = QdrantClient(url=QDRANT_URL)
    
    # Create collection if it doesn't exist (optimizes for speed)
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
        )
        print(f"✅ Created collection '{COLLECTION_NAME}'")

    # 5. Index Data
    print("🔄 Indexing chunks into Vector Database...")
    QdrantVectorStore.from_documents(
        chunks,
        embeddings,
        url=QDRANT_URL,
        collection_name=COLLECTION_NAME,
        force_recreate=True # For dev only: overwrites DB each run
    )
    
    print("🚀 Ingestion Complete! Data is stored in Qdrant.")

if __name__ == "__main__":
    main()
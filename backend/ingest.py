import os
import hashlib
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_qdrant.sparse_embeddings import SparseEmbeddings, SparseVector
from qdrant_client import QdrantClient
from qdrant_client.http import models

class HashedSparseEmbeddings(SparseEmbeddings):
    def __init__(self, num_features: int = 1048576):
        self.num_features = num_features

    def _hash_token(self, token: str) -> int:
        return int(hashlib.md5(token.encode('utf-8')).hexdigest(), 16) % self.num_features

    def embed_documents(self, texts: list[str]) -> list[SparseVector]:
        vectors = []
        for text in texts:
            tokens = [t.lower() for t in text.split() if t.isalnum()]
            tf = {}
            for token in tokens:
                idx = self._hash_token(token)
                tf[idx] = tf.get(idx, 0) + 1
            
            sorted_indices = sorted(tf.keys())
            sorted_values = [float(tf[idx]) for idx in sorted_indices]
            vectors.append(SparseVector(indices=sorted_indices, values=sorted_values))
        return vectors

    def embed_query(self, text: str) -> SparseVector:
        return self.embed_documents([text])[0]

# --- Configuration ---
PDF_PATH = "sample_regulation.pdf"
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
            sparse_vectors_config={
                "text-sparse": models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=True)
                )
            }
        )
        print(f"✅ Created collection '{COLLECTION_NAME}'")

    # 5. Index Data
    print("🔄 Indexing chunks into Vector Database...")
    QdrantVectorStore.from_documents(
        chunks,
        embeddings,
        url=QDRANT_URL,
        collection_name=COLLECTION_NAME,
        sparse_embedding=HashedSparseEmbeddings(),
        sparse_vector_name="text-sparse",
        retrieval_mode=RetrievalMode.HYBRID,
        force_recreate=True # For dev only: overwrites DB each run
    )
    
    print("🚀 Ingestion Complete! Data is stored in Qdrant.")

if __name__ == "__main__":
    main()
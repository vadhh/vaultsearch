import os
import shutil
import time
import hashlib
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_qdrant.sparse_embeddings import SparseEmbeddings, SparseVector
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
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
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
COLLECTION_NAME = "vault_documents"
MODEL_NAME = "llama3"

app = FastAPI(title="VaultSearch API")

# --- CORS & Startup ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🚀 Initializing AI Brain...")

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
client = QdrantClient(url=QDRANT_URL)
llm = ChatOllama(model=MODEL_NAME, base_url=OLLAMA_URL)

for attempt in range(1, 6):
    try:
        if client.collection_exists(COLLECTION_NAME):
            info = client.get_collection(COLLECTION_NAME)
            sparse_configured = False
            if info.config.params.sparse_vectors and "text-sparse" in info.config.params.sparse_vectors:
                sparse_configured = True
            
            if not sparse_configured:
                print("⚠️ Existing collection does not support sparse vectors. Re-creating for Hybrid Search...")
                client.delete_collection(COLLECTION_NAME)
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
                    sparse_vectors_config={
                        "text-sparse": models.SparseVectorParams(
                            index=models.SparseIndexParams(on_disk=True)
                        )
                    }
                )
        else:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
                sparse_vectors_config={
                    "text-sparse": models.SparseVectorParams(
                        index=models.SparseIndexParams(on_disk=True)
                    )
                }
            )
        print("✅ Connected to Qdrant successfully with Hybrid Search configuration.")
        break
    except Exception as e:
        print(f"⚠️ Qdrant not ready yet (attempt {attempt}/5). Error: {e}")
        if attempt == 5:
            print("❌ Qdrant connection failed permanently.")
        else:
            time.sleep(2)

vectorstore = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
    sparse_embedding=HashedSparseEmbeddings(),
    sparse_vector_name="text-sparse",
    retrieval_mode=RetrievalMode.HYBRID,
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

template = """You are a strict compliance assistant. 
Answer based ONLY on the following context. 
If unknown, say "I don't know."

Context:
{context}

Question: {question}
"""
prompt = ChatPromptTemplate.from_template(template)

class QueryRequest(BaseModel):
    question: str

# --- ENDPOINTS ---

@app.get("/documents")
def get_documents():
    try:
        if not client.collection_exists(COLLECTION_NAME):
            return {"documents": []}
        
        unique_docs = set()
        next_offset = None
        debug_printed = False
        
        while True:
            records, next_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=100,
                with_payload=True,
                offset=next_offset
            )
            
            if not debug_printed and records:
                print(f"🔍 RAW RECORD PAYLOAD: {records[0].payload}")
                debug_printed = True

            for record in records:
                payload = record.payload or {}
                source = None

                if "source" in payload:
                    source = payload["source"]
                
                elif "metadata" in payload and isinstance(payload["metadata"], dict):
                     source = payload["metadata"].get("source")
                
                if not source:
                    for k, v in payload.items():
                        if isinstance(v, str) and v.lower().endswith(".pdf"):
                            source = v
                            break

                if source:
                    unique_docs.add(source)
            
            if next_offset is None:
                break
                
        return {"documents": list(unique_docs)}
    except Exception as e:
        print(f"⚠️ Error fetching docs: {e}")
        return {"documents": []}

@app.delete("/documents/{filename}")
def delete_document(filename: str):
    try:
        safe_filename = os.path.basename(filename.replace('\\', '/'))
        print(f"🗑️ Attempting to delete: {safe_filename}")
        
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    should=[
                        models.FieldCondition(
                            key="source",
                            match=models.MatchValue(value=safe_filename),
                        ),
                        models.FieldCondition(
                            key="metadata.source",
                            match=models.MatchValue(value=safe_filename),
                        ),
                    ],
                )
            ),
        )
        return {"status": "success", "message": f"Deleted {safe_filename}"}
    except Exception as e:
        print(f"❌ Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
def upload_document(file: UploadFile = File(...)):
    try:
        # Sanitize filename to prevent path traversal issues
        safe_filename = os.path.basename(file.filename.replace('\\', '/'))
        temp_file_path = f"temp_{int(time.time())}_{safe_filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"📄 Processing: {safe_filename}")

        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50, separators=["\n\n", "\n", ".", " "]
        )
        chunks = text_splitter.split_documents(docs)

        for chunk in chunks:
            chunk.metadata["source"] = safe_filename

        vectorstore.add_documents(chunks)
        os.remove(temp_file_path)
        
        return JSONResponse(content={"status": "success", "chunks": len(chunks)})

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: QueryRequest):
    try:
        docs = retriever.invoke(request.question)
        context_text = "\n\n".join([doc.page_content for doc in docs])
        
        sources = []
        seen_pages = set()
        for doc in docs:
            page = doc.metadata.get("page", "?")
            source = doc.metadata.get("source", "Unknown")
            identifier = f"{source} (Page {page})"
            if identifier not in seen_pages:
                sources.append(identifier)
                seen_pages.add(identifier)

        async def generate():
            chain = prompt | llm
            async for chunk in chain.astream({"context": context_text, "question": request.question}):
                yield chunk.content
            
            if sources:
                yield "\n\n---\n**📚 Verified Sources:**\n"
                for src in sources:
                    yield f"- 📄 {src}\n"
            else:
                yield "\n\n(No specific documents found)"

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        return StreamingResponse(iter([f"Error: {e}"]), media_type="text/plain")
import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.http import models

# --- Configuration ---
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
COLLECTION_NAME = "vault_documents"
MODEL_NAME = "llama3"

app = FastAPI(title="VaultSearch API")

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

if not client.collection_exists(COLLECTION_NAME):
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
    )

vectorstore = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
llm = ChatOllama(model=MODEL_NAME, base_url=OLLAMA_URL)

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
    """
    Scans Qdrant to find all unique 'source' filenames.
    Safe version: Returns empty list if collection is missing.
    """
    try:
        # 1. Check if collection exists first
        if not client.collection_exists(COLLECTION_NAME):
            return {"documents": []}

        unique_docs = set()
        next_offset = None
        
        while True:
            records, next_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=None,
                limit=100,
                with_payload=True,
                offset=next_offset
            )
            
            for record in records:
                if "source" in record.payload:
                    unique_docs.add(record.payload["source"])
            
            if next_offset is None:
                break
                
        return {"documents": list(unique_docs)}
    
    except Exception as e:
        # Log the error
        print(f"⚠️ Error fetching docs (returning empty list): {e}")
        return {"documents": []}

@app.delete("/documents/{filename}")
def delete_document(filename: str):
    """
    Hard Delete: Removes all vectors where metadata.source == filename
    """
    try:
        print(f"🗑️ Deleting all chunks for: {filename}")
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source",
                            match=models.MatchValue(value=filename),
                        ),
                    ],
                )
            ),
        )
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        print(f"❌ Error deleting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"📄 Processing: {file.filename}")

        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50, separators=["\n\n", "\n", ".", " "]
        )
        chunks = text_splitter.split_documents(docs)

        # Tag every single chunk
        for chunk in chunks:
            chunk.metadata["source"] = file.filename

        vectorstore.add_documents(chunks)
        os.remove(temp_file_path)
        
        return JSONResponse(content={"status": "success", "chunks": len(chunks)})

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: QueryRequest):
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

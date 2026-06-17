import hashlib
from langchain_qdrant.sparse_embeddings import SparseEmbeddings, SparseVector

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

def test_sparse_embeddings():
    embedder = HashedSparseEmbeddings()
    
    # 1. Single term test
    vec1 = embedder.embed_query("compliance")
    assert isinstance(vec1, SparseVector), "Must return SparseVector"
    assert len(vec1.indices) == 1, "Must contain exactly one index"
    assert len(vec1.values) == 1, "Must contain exactly one value"
    assert vec1.values[0] == 1.0, "Frequency must be 1.0"
    
    # 2. Repeated terms test
    vec2 = embedder.embed_query("compliance compliance auditing")
    assert len(vec2.indices) == 2, "Must merge repeated terms into 2 indices"
    
    # Verify index sorting (required by Qdrant client)
    assert vec2.indices == sorted(vec2.indices), "Indices must be sorted ascending"
    
    # Find index of compliance in the sorted vector
    comp_idx = embedder._hash_token("compliance")
    audit_idx = embedder._hash_token("auditing")
    
    comp_pos = vec2.indices.index(comp_idx)
    audit_pos = vec2.indices.index(audit_idx)
    
    assert vec2.values[comp_pos] == 2.0, "compliance must have frequency 2.0"
    assert vec2.values[audit_pos] == 1.0, "auditing must have frequency 1.0"
    
    # 3. Document collection test
    docs = ["hello world", "test compliance"]
    vectors = embedder.embed_documents(docs)
    assert len(vectors) == 2, "Must return two vectors"
    assert len(vectors[0].indices) == 2
    assert len(vectors[1].indices) == 2

if __name__ == "__main__":
    test_sparse_embeddings()
    print("✅ All HashedSparseEmbeddings self-checks passed successfully!")

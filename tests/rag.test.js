describe('RAG Service - Cosine Similarity', () => {
  function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  it('should return 1 for identical vectors', () => {
    const vec = [1, 2, 3, 4, 5];
    const similarity = cosineSimilarity(vec, vec);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(0.0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [-1, -2, -3];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(-1.0, 5);
  });

  it('should handle zero vectors', () => {
    const vecA = [0, 0, 0];
    const vecB = [1, 2, 3];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBe(0);
  });

  it('should return values between -1 and 1', () => {
    const vecA = [0.5, -0.3, 0.8, 0.1];
    const vecB = [0.2, 0.7, -0.4, 0.9];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeGreaterThanOrEqual(-1);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('should compute similarity for high-dimensional vectors', () => {
    const dim = 1536;
    const vecA = Array.from({ length: dim }, () => Math.random() - 0.5);
    const vecB = Array.from({ length: dim }, () => Math.random() - 0.5);
    const similarity = cosineSimilarity(vecA, vecB);
    expect(typeof similarity).toBe('number');
    expect(similarity).not.toBeNaN();
  });
});

describe('RAG Service - Document Scoring', () => {
  it('should rank documents by similarity score', () => {
    const docs = [
      { title: 'Doc A', similarity: 0.8 },
      { title: 'Doc C', similarity: 0.3 },
      { title: 'Doc B', similarity: 0.95 },
    ];

    docs.sort((a, b) => b.similarity - a.similarity);

    expect(docs[0].title).toBe('Doc B');
    expect(docs[1].title).toBe('Doc A');
    expect(docs[2].title).toBe('Doc C');
  });

  it('should filter documents below threshold', () => {
    const threshold = 0.3;
    const docs = [
      { title: 'Relevant', similarity: 0.8 },
      { title: 'Borderline', similarity: 0.3 },
      { title: 'Irrelevant', similarity: 0.1 },
    ];

    const relevant = docs.filter((d) => d.similarity >= threshold);
    expect(relevant.length).toBe(2);
    expect(relevant.map((d) => d.title)).toContain('Relevant');
    expect(relevant.map((d) => d.title)).toContain('Borderline');
  });

  it('should return top K documents', () => {
    const K = 3;
    const docs = Array.from({ length: 10 }, (_, i) => ({
      title: `Doc ${i}`,
      similarity: Math.random(),
    }));

    docs.sort((a, b) => b.similarity - a.similarity);
    const topK = docs.slice(0, K);

    expect(topK.length).toBe(K);
    expect(topK[0].similarity).toBeGreaterThanOrEqual(topK[1].similarity);
    expect(topK[1].similarity).toBeGreaterThanOrEqual(topK[2].similarity);
  });
});

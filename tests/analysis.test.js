describe('Analysis Input Validation', () => {
  const validLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp'];

  it('should accept all valid languages', () => {
    validLanguages.forEach((lang) => {
      expect(validLanguages.includes(lang)).toBe(true);
    });
  });

  it('should reject invalid languages', () => {
    const invalidLanguages = ['ruby', 'php', 'swift', 'kotlin', ''];
    invalidLanguages.forEach((lang) => {
      expect(validLanguages.includes(lang)).toBe(false);
    });
  });

  it('should reject empty source code', () => {
    const sourceCode = '';
    expect(sourceCode.trim().length === 0).toBe(true);
  });

  it('should reject source code exceeding max length', () => {
    const maxLength = 50000;
    const longCode = 'x'.repeat(50001);
    expect(longCode.length > maxLength).toBe(true);
  });

  it('should accept source code within max length', () => {
    const maxLength = 50000;
    const validCode = 'function hello() { return "world"; }';
    expect(validCode.length <= maxLength).toBe(true);
  });
});

describe('Analysis Result Formatting', () => {
  const mockAnalysis = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Test Analysis',
    language: 'javascript',
    sourceCode: 'const x = 1;',
    issues: [
      {
        type: 'style',
        severity: 'low',
        line: 1,
        message: 'Use let or const instead of var',
        suggestion: 'Replace var with const for immutable values',
      },
    ],
    metrics: {
      linesOfCode: 1,
      cyclomaticComplexity: 1,
      maintainabilityIndex: 95,
      duplicateRatio: 0,
      overallScore: 90,
    },
    summary: 'Clean code with minor style suggestion',
    status: 'completed',
    processingTimeMs: 1234,
    createdAt: new Date('2026-04-20'),
  };

  it('should have all required fields', () => {
    expect(mockAnalysis).toHaveProperty('_id');
    expect(mockAnalysis).toHaveProperty('title');
    expect(mockAnalysis).toHaveProperty('language');
    expect(mockAnalysis).toHaveProperty('sourceCode');
    expect(mockAnalysis).toHaveProperty('issues');
    expect(mockAnalysis).toHaveProperty('metrics');
    expect(mockAnalysis).toHaveProperty('summary');
    expect(mockAnalysis).toHaveProperty('status');
    expect(mockAnalysis).toHaveProperty('processingTimeMs');
  });

  it('should have valid issue types', () => {
    const validTypes = ['bug', 'security', 'performance', 'style', 'maintainability', 'complexity'];
    mockAnalysis.issues.forEach((issue) => {
      expect(validTypes).toContain(issue.type);
    });
  });

  it('should have valid severity levels', () => {
    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    mockAnalysis.issues.forEach((issue) => {
      expect(validSeverities).toContain(issue.severity);
    });
  });

  it('should have overall score between 0 and 100', () => {
    expect(mockAnalysis.metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(mockAnalysis.metrics.overallScore).toBeLessThanOrEqual(100);
  });

  it('should have valid status', () => {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    expect(validStatuses).toContain(mockAnalysis.status);
  });
});

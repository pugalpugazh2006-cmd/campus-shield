import { BadRequestException } from '@nestjs/common';
import { FirestoreDocumentIdPipe } from './firestore-document-id.pipe';

describe('FirestoreDocumentIdPipe', () => {
  const pipe = new FirestoreDocumentIdPipe();

  it('accepts generated Firebase identifiers', () => {
    expect(pipe.transform('AbC_123-xYz')).toBe('AbC_123-xYz');
  });

  it('rejects path traversal and nested document paths', () => {
    expect(() => pipe.transform('../users/admin')).toThrow(BadRequestException);
  });
});

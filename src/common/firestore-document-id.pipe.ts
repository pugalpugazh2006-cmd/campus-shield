import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SAFE_DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable()
export class FirestoreDocumentIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!SAFE_DOCUMENT_ID.test(value)) {
      throw new BadRequestException('Invalid resource identifier');
    }
    return value;
  }
}

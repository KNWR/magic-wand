export enum DocumentTypes {
  Prevote = 'prevote',
  ExternalSnapshot = 'external-snapshot',
  InternalSnapshot = 'internal-snapshot',
}

/* Describes JSON validation schema for the gDriveService. */
export interface GoogleDriveDocument {
  documentType: DocumentTypes;
  companyId: number;

  documentId?: string;
}

export const gDriveSchema = {
  type: 'object',
  required: ['documentType', 'companyId'],

  properties: {
    documentType: {
      type: 'string',
      enum: Object.values(DocumentTypes),
    },
    companyId: { type: 'integer' },
  },
};

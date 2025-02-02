import { HookContext } from '@feathersjs/feathers';
import Ajv from 'ajv';
import {
  AjvOrNewable,
  disallow,
  iff,
  validateSchema,
} from 'feathers-hooks-common';
import { Company } from '../../../client/schemas/company';
import {
  gDriveSchema,
  GoogleDriveDocument,
} from '../../../client/schemas/gdrive';

const ajv = new Ajv({ allErrors: true, $data: true });

const companyHasDocument = async (ctx: HookContext<GoogleDriveDocument>) => {
  const company = (await ctx.app
    .service('api/companies')
    .get(ctx.data.companyId)) as Company;

  return !!company.companyLinks.find(
    (link) => link.name === ctx.data.documentType
  );
};

const addLinkToCompany = async (ctx: HookContext<GoogleDriveDocument>) => {
  const { googleFolderId, documentId, documentType, companyId } = ctx.result;

  const company = await ctx.app.service('api/companies').get(companyId);
  const docLink = `https://docs.google.com/document/d/${documentId}`;

  await ctx.app.service('api/companies').patch(companyId, {
    companyLinks: [
      ...company.companyLinks,
      { name: documentType, url: docLink },
    ],
    googleFolderId,
  });
};

export default {
  before: {
    all: [disallow('external')],
    find: [],
    get: [],
    create: [
      iff(companyHasDocument, disallow()),
      validateSchema(gDriveSchema, ajv as AjvOrNewable),
    ], // TODO: Validate Permissions
    update: [validateSchema(gDriveSchema, ajv as AjvOrNewable)],
    patch: [validateSchema(gDriveSchema, ajv as AjvOrNewable)],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [addLinkToCompany],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};

import Ajv from 'ajv';
import { gDriveSchema } from '../../../client/schemas/gdrive';
import {AjvOrNewable, validateSchema} from "feathers-hooks-common";

const ajv = new Ajv({ allErrors: true, $data: true });

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [validateSchema(gDriveSchema, <AjvOrNewable>ajv)], // TODO: Validate Permissions
    update: [validateSchema(gDriveSchema, <AjvOrNewable>ajv)],
    patch: [validateSchema(gDriveSchema, <AjvOrNewable>ajv)],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
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

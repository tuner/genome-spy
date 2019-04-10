
import { formalizeEncodingConfig, createFieldEncodingMapper, createCompositeEncodingMapper } from './visualEncoders';
import { gatherTransform } from './transforms/gather';
import { calculateTransform } from './transforms/calculate';

/**
 * @typedef {Object} SimpleFilterConfig
 * @prop {string} field 
 * @prop {string} operator eq, neq, lt, lte, gte, gt
 * @prop {*} value
 * 
 */

const transformers = {
    gather: gatherTransform,
    simpleFilter: simpleFilterTransform,
    calculate: calculateTransform
};

/**
 * 
 * @param {object[]} transformConfigs 
 */
export function transformData(transformConfigs, rows) {
    for (const transformConfig of transformConfigs) {
        const type = transformConfig.type;
        if (!type) {
            throw new Error("Type not defined in transformConfig!");
        }

        const transformer = transformers[type];
        if (!transformer) {
            throw new Error(`Unknown transformer type: ${type}`);
        }

        rows = transformer(transformConfig, rows);
    }

    return rows;
}

/**
 * 
 * @param {object[]} encodingConfigs 
 * @param {object[]} rows 
 * @param {import("./visualEncoders").VisualMapperFactory} mapperFactory
 * @returns {object[]}
 */
export function processData(encodingConfigs, rows, mapperFactory) {

    // TODO: Validate that data contains all fields that are referenced in the config.
    // ... just to prevent mysterious undefineds

    const encode = createCompositeEncodingMapper(mapperFactory, encodingConfigs, rows);

    return rows.map(d => encode(d));
}


/**
 * 
 * @param {SimpleFilterConfig} simpleFilterConfig 
 * @param {Object[]} rows
 */
export function simpleFilterTransform(simpleFilterConfig, rows) {
    return rows.filter(createFilter(simpleFilterConfig));
}

/**
 * 
 * @param {SimpleFilterConfig} filterConfig 
 */
 export function createFilter(filterConfig) {
     const v = filterConfig.value;

     const accessor = x => x[filterConfig.field];

     // Assume that x is a string. Not very robust, but should be enough for now
     switch (filterConfig.operator) {
         case "eq":  return x => accessor(x) == v;
         case "neq": return x => accessor(x) != v;
         case "lt":  return x => accessor(x) < v;
         case "lte": return x => accessor(x) <= v;
         case "gte": return x => accessor(x) >= v;
         case "gt":  return x => accessor(x) > v;
         default:
            throw new Error(`Unknown operator: ${filterConfig.operator}`);
     }
 }

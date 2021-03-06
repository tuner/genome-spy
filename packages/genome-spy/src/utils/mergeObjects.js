/**
 *
 * @param  {object[]} objects
 * @param {string} propertyOf
 * @param {string[]} [skip]
 * @returns {object}
 */
export default function mergeObjects(objects, propertyOf, skip) {
    skip = skip || [];

    if (objects.some(d => d === null)) {
        if (objects.every(d => d === null)) {
            return null;
        } else {
            console.warn(objects);
            throw new Error("Cannot merge objects with nulls!");
        }
    }

    /** @type {any} */
    const target = {};

    /** @param {any} obj */
    const merger = obj => {
        for (let prop in obj) {
            if (!skip.includes(prop) && obj[prop] !== undefined) {
                if (target[prop] !== undefined && target[prop] !== obj[prop]) {
                    console.warn(
                        `Conflicting property ${prop} of ${propertyOf}: (${JSON.stringify(
                            target[prop]
                        )} and ${JSON.stringify(
                            obj[prop]
                        )}). Using ${JSON.stringify(target[prop])}.`
                    );
                } else {
                    target[prop] = obj[prop];
                }
            }
        }
    };

    for (const o of objects) {
        merger(o);
    }

    return target;
}

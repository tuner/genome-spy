import { getViewClass } from "./viewUtils";
import ContainerView from "./containerView";

/**
 * @typedef {import("./view").default} View
 */
export default class LayerView extends ContainerView {
    /**
     *
     * @param {import("./viewUtils").LayerSpec} spec
     * @param {import("./viewUtils").ViewContext} context
     * @param {ContainerView} parent
     * @param {string} name
     */
    constructor(spec, context, parent, name) {
        super(spec, context, parent, name);

        /** @type { View[] } */
        this.children = (spec.layer || []).map((childSpec, i) => {
            const View = getViewClass(childSpec);
            return new View(childSpec, context, this, `layer${i}`);
        });
    }

    /**
     * @returns {IterableIterator<View>}
     */
    *[Symbol.iterator]() {
        for (const child of this.children) {
            yield child;
        }
    }

    /**
     * @param {import("../utils/layout/rectangle").default} coords
     * @param {any} [facetId]
     * @param {import("./view").DeferredRenderingRequest[]} [deferBuffer]
     */
    render(coords, facetId, deferBuffer) {
        coords = coords.shrink(this.getPadding());

        for (const child of this.children) {
            child.render(coords, facetId, deferBuffer);
        }
    }
}

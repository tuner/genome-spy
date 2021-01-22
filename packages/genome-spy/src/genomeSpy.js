import scaleLocus from "./genome/scaleLocus";
import { scale as vegaScale } from "vega-scale";

import "./styles/genome-spy.scss";
import Tooltip from "./utils/ui/tooltip";

import AccessorFactory from "./encoder/accessor";
import {
    createView,
    resolveScalesAndAxes,
    addDecorators,
    processImports
} from "./view/viewUtils";
import UnitView from "./view/unitView";
import createDomain from "./utils/domainArray";

import WebGLHelper from "./gl/webGLHelper";
import { parseSizeDef } from "./utils/layout/flexLayout";
import Rectangle from "./utils/layout/rectangle";
import DeferredViewRenderingContext from "./view/renderingContext/deferredViewRenderingContext";
import LayoutRecorderViewRenderingContext from "./view/renderingContext/layoutRecorderViewRenderingContext";
import CompositeViewRenderingContext from "./view/renderingContext/compositeViewRenderingContext";
import InteractionEvent from "./utils/interactionEvent";
import Point from "./utils/layout/point";
import { isContextMenuOpen } from "./utils/ui/contextMenu";
import Animator from "./utils/animator";
import DataFlow from "./data/dataFlow";
import scaleIndex from "./genome/scaleIndex";
import { buildDataFlow } from "./view/flowBuilder";
import { optimizeDataFlow } from "./data/flowOptimizer";
import scaleNull from "./utils/scaleNull";
import GenomeStore from "./genome/genomeStore";

/**
 * @typedef {import("./spec/view").UnitSpec} UnitSpec
 * @typedef {import("./spec/view").ViewSpec} ViewSpec
 * @typedef {import("./spec/view").ImportSpec} ImportSpec
 * @typedef {import("./spec/view").VConcatSpec} TrackSpec
 * @typedef {import("./spec/view").RootSpec} RootSpec
 * @typedef {import("./spec/view").RootConfig} RootConfig
 */

// Register scaleLocus to Vega-Scale.
// Loci are discrete but the scale's domain can be adjusted in a continuous manner.
vegaScale("index", scaleIndex, ["continuous"]);
vegaScale("locus", scaleLocus, ["continuous"]);
vegaScale("null", scaleNull, []);

/**
 * The actual browser without any toolbars etc
 */
export default class GenomeSpy {
    /**
     *
     * @param {HTMLElement} container
     * @param {RootSpec} config
     */
    constructor(container, config) {
        this.container = container;

        /** Root level configuration object */
        this.config = config;

        this.accessorFactory = new AccessorFactory();

        /** @type {(function(string):object[])[]} */
        this.namedDataProviders = [];

        this.animator = new Animator(() => this.renderAll());

        /** @type {GenomeStore} */
        this.genomeStore = undefined;
    }

    /**
     *
     * @param {function(string):object[]} provider
     */
    registerNamedDataProvider(provider) {
        this.namedDataProviders.unshift(provider);
    }

    /**
     *
     * @param {string} name
     */
    getNamedData(name) {
        for (const provider of this.namedDataProviders) {
            const data = provider(name);
            if (data) {
                return data;
            }
        }
    }

    /**
     * Broadcast a message to all views
     *
     * @param {string} type
     * @param {any} [payload]
     */
    broadcast(type, payload) {
        const message = { type, payload };
        this.viewRoot.visit(view => view.handleBroadcast(message));
    }

    _prepareContainer() {
        this.container.classList.add("genome-spy");
        this.container.classList.add("loading");

        this._glHelper = new WebGLHelper(this.container);
        this._glHelper.addEventListener("resize", () => this.computeLayout());
        this._glHelper.addEventListener("render", () =>
            this.animator.requestRender()
        );

        this.loadingMessageElement = document.createElement("div");
        this.loadingMessageElement.className = "loading-message";
        this.loadingMessageElement.innerHTML = `<div class="message">Loading<span class="ellipsis">...</span></div>`;
        this.container.appendChild(this.loadingMessageElement);

        this.tooltip = new Tooltip(this.container);

        this.loadingMessageElement
            .querySelector(".message")
            .addEventListener("transitionend", () => {
                /** @type {HTMLElement} */ (this.loadingMessageElement).style.display =
                    "none";
            });
    }

    /**
     * Unregisters all listeners, removes all created dom elements, removes all css classes from the container
     */
    destroy() {
        /*
        for (const e of this._listeners) {
            e.target.removeEventListener(e.type, e.listener);
        }
        */

        this.container.classList.remove("genome-spy");
        this.container.classList.remove("loading");

        throw new Error("destroy() not properly implemented");
    }

    async _prepareViewsAndData() {
        if (this.config.genome) {
            this.genomeStore = new GenomeStore(this);
            await this.genomeStore.initialize(this.config.genome);
        }

        /** @type {import("./view/viewContext").default} */
        const context = {
            dataFlow: new DataFlow(),
            accessorFactory: this.accessorFactory,
            glHelper: this._glHelper,
            animator: this.animator,
            genomeStore: this.genomeStore,
            requestLayoutReflow: this.computeLayout.bind(this),
            updateTooltip: this.updateTooltip.bind(this)
        };

        /** @type {import("./spec/view").ConcatSpec & RootConfig} */
        const rootSpec = this.config;

        // Create the view hierarchy
        /** @type {import("./view/view").default} */
        this.viewRoot = createView(rootSpec, context);

        // Replace placeholder ImportViews with actual views.
        await processImports(this.viewRoot);

        // Resolve scales, i.e., if possible, pull them towards the root
        resolveScalesAndAxes(this.viewRoot);

        // Wrap unit or layer views that need axes
        this.viewRoot = addDecorators(this.viewRoot);

        // Collect all unit views to a list because they need plenty of initialization
        /** @type {UnitView[]} */
        const unitViews = [];
        this.viewRoot.visit(view => {
            if (view instanceof UnitView) {
                unitViews.push(view);
            }
        });

        // Create encoders (accessors, scales and related metadata)
        unitViews.forEach(view => view.mark.initializeEncoders());

        // Compile shaders, create or load textures, etc.
        const graphicsInitialized = Promise.all(
            // TODO: The compilation should be initiated here but the
            // statuses should be checked later to allow for background compilation.
            // Also: https://www.khronos.org/registry/webgl/extensions/KHR_parallel_shader_compile/
            unitViews.map(view => view.mark.initializeGraphics())
        );

        // Build the data flow based on the view hierarchy
        const flow = buildDataFlow(this.viewRoot, context.dataFlow);
        optimizeDataFlow(flow);

        for (const view of unitViews) {
            flow.addObserver(collector => {
                // TODO: Replace initializeData with a faceted dataflow
                view.mark.initializeData();
                // Update WebGL buffers
                view.mark.updateGraphicsData();
            }, view);
        }

        // Find all data sources and initiate loading
        await Promise.all(
            flow.dataSources.map(dataSource => dataSource.load())
        );

        // Now that all data has been loaded, the domains may need adjusting
        this.viewRoot.visit(view => {
            for (const resolution of Object.values(view.resolutions.scale)) {
                // IMPORTANT TODO: Check that discrete domains and indexers match!!!!!!!!!
                resolution.reconfigure();
            }
        });

        // Ensure that all external textures (font atlases) have been loaded
        await graphicsInitialized;

        for (const view of unitViews) {
            view.mark.finalizeGraphicsInitialization();
        }
    }

    // TODO: Come up with a sensible name. And maybe this should be called at the end of the constructor.
    async launch() {
        this._prepareContainer();

        try {
            await this._prepareViewsAndData();

            this.registerMouseEvents();
            this.computeLayout();
            this.renderAll();

            return this;
        } catch (reason) {
            const message = `${
                reason.view ? `At "${reason.view.getPathString()}": ` : ""
            }${reason.toString()}`;
            console.error(reason.stack);
            createMessageBox(this.container, message);
        } finally {
            this.container.classList.remove("loading");
        }
    }

    registerMouseEvents() {
        const canvas = this._glHelper.canvas;

        /** @param {Event} event */
        const listener = event => {
            if (this.layout && event instanceof MouseEvent) {
                if (event.type == "mousemove") {
                    this.tooltip.handleMouseMove(event);
                    this._tooltipUpdateRequested = false;
                }

                const rect = canvas.getBoundingClientRect();
                const point = new Point(
                    event.clientX - rect.left - canvas.clientLeft,
                    event.clientY - rect.top - canvas.clientTop
                );

                this.layout.dispatchInteractionEvent(
                    new InteractionEvent(point, event)
                );

                if (!this._tooltipUpdateRequested) {
                    this.tooltip.clear();
                }
            }
        };

        [
            "mousedown",
            "wheel",
            "click",
            "mousemove",
            "gesturechange",
            "contextmenu"
        ].forEach(type => canvas.addEventListener(type, listener));

        // Prevent text selections etc while dragging
        canvas.addEventListener("dragstart", event => event.stopPropagation());
    }

    /**
     * This method should be called in a mouseMove handler. If not called, the
     * tooltip will be hidden.
     *
     * @param {T} datum
     * @param {function(T):(string | import("lit-html").TemplateResult)} [converter]
     * @template T
     */
    updateTooltip(datum, converter) {
        if (isContextMenuOpen()) {
            return;
        }

        if (!this._tooltipUpdateRequested) {
            this.tooltip.updateWithDatum(datum, converter);
            this._tooltipUpdateRequested = true;
        } else {
            throw new Error(
                "Tooltip has already been updated! Duplicate event handler?"
            );
        }
    }

    computeLayout() {
        const root = this.viewRoot;
        if (!root) {
            return;
        }

        this.broadcast("layout");

        const canvasSize = this._glHelper.getLogicalCanvasSize();

        /** @param {"width" | "height"} c */
        const getComponent = c =>
            (root.spec[c] && parseSizeDef(root.spec[c]).grow
                ? canvasSize[c]
                : root.getSize()[c].px) || canvasSize[c];

        this.deferredContext = new DeferredViewRenderingContext();
        const layoutRecorder = new LayoutRecorderViewRenderingContext();

        root.render(
            new CompositeViewRenderingContext(
                this.deferredContext,
                layoutRecorder
            ),
            new Rectangle(0, 0, getComponent("width"), getComponent("height"))
        );

        this.layout = layoutRecorder.getLayout();

        this.broadcast("layoutComputed");
    }

    renderAll() {
        // TODO: Move gl stuff to renderingContext
        const gl = this._glHelper.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (this.viewRoot) {
            this.deferredContext.renderDeferred();
        }
    }

    getSearchableViews() {
        /** @type {UnitView[]} */
        const views = [];
        this.viewRoot.visit(view => {
            if (view instanceof UnitView && view.getAccessor("search")) {
                views.push(view);
            }
        });
        return views;
    }
}

/**
 *
 * @param {HTMLElement} container
 * @param {string} message
 */
function createMessageBox(container, message) {
    // Uh, need a templating thingy
    const messageBox = document.createElement("div");
    messageBox.className = "message-box";
    const messageText = document.createElement("div");
    messageText.textContent = message;
    messageBox.appendChild(messageText);
    container.appendChild(messageBox);
}

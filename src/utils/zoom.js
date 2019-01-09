/**
 * Partially based on d3-zoom:
 * https://github.com/d3/d3-zoom/ Copyright 2010-2016 Mike Bostock
 */

import * as d3 from 'd3';

export class Zoom {
    constructor(listener) {
        this.scaleExtent = [0, Infinity];
        this.wheelMultiplier = -(event.deltaMode ? 120 : 1);
        this.listener = listener;
        this.transform = new Transform(1.0, 0);

        this.mouseDown = false;
        this.lastPoint = null;
    }

    /**
     * Adds mouse/touch listeners for zoom
     * 
     * @param {object} element 
     */
    attachZoomEvents(element) {
        ["mousedown", "mouseup", "mousemove", "wheel"].forEach(type =>
            element.addEventListener(
                type,
                e => this.handleMouseEvent(e, d3.clientPoint(element, e), element),
                false));
    }

    zoomTo(transform) {
        // TODO: Implement
    }

    handleMouseEvent(event, point, element) {

        // TODO: Handle window resizes. Record previous clientWidth and adjust k and x accordingly.

        const mouseX = point[0];
        const mouseY = point[1];

        function constrainX(transform) {
            return new Transform(
                transform.k,
                Math.min(0, Math.max(transform.x, -(transform.k - 1) * element.clientWidth))
            );
        }

        if (event.type == "wheel") {
            event.stopPropagation();
            event.preventDefault();

            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                this.transform = constrainX(new Transform(
                    this.transform.k,
                    this.transform.x + event.deltaX * this.wheelMultiplier));

            } else {
                // https://medium.com/@auchenberg/detecting-multi-touch-trackpad-gestures-in-javascript-a2505babb10e
                // TODO: Safari gestures
                const divisor  = event.ctrlKey ? 100 : 500;

                let kFactor = Math.pow(2, event.deltaY * this.wheelMultiplier / divisor);

                const k = Math.max(Math.min(this.transform.k * kFactor, this.scaleExtent[1]), this.scaleExtent[0]);

                kFactor = k / this.transform.k;

                const x = (this.transform.x - mouseX) * kFactor + mouseX;

                this.transform = constrainX(new Transform(k, x));
            }

            this.listener(this.transform);

        } else if (event.type == "mousedown" && event.button == 0) {
            this.mouseDown = true;
            this.lastPoint = point;

        } else if (event.type == "mouseup" && this.mouseDown) {
            this.mouseDown = false;
            this.lastPoint = null;

        } else if (event.type == "mousemove" && this.mouseDown) {
            if (event.buttons & 1) {
                this.transform = this.transform.translate(mouseX - this.lastPoint[0]);
                this.lastPoint = point;

                event.preventDefault();

                this.listener(this.transform);

            } else {
                this.mouseDown = false;
                this.lastPoint = 0;
            }
        }

        

    }
}

export class Transform {
    constructor(k, x) {
        this.k = k;
        this.x = x;
    }

    translate(x) {
        return new Transform(this.k, this.x + x);
    }

    invert(x) {
        return (x - this.x) / this.k;
    }

    rescale(x) {
        return x.copy().domain(x.range().map(this.invert, this).map(x.invert, x));
    }

    toString() {
        return `translate(${this.x}) scale(${this.k})`;
    }
}
export interface Point {
    x: number;
    y: number;
    t: number; // timestamp
}

export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

export class Stroke {
    public points: Point[] = [];

    constructor(points?: Point[]) {
        if (points) this.points = points;
    }

    addPoint(x: number, y: number, t?: number): void {
        this.points.push({ x, y, t: t ?? Date.now() });
    }

    getBoundingBox(): BoundingBox {
        if (this.points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const p of this.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        const width = maxX - minX;
        const height = maxY - minY;

        return {
            minX, minY, maxX, maxY,
            width, height,
            centerX: minX + width / 2,
            centerY: minY + height / 2,
        };
    }

    /**
     * Total path length of the stroke
    */
    getLength(): number {
        let len = 0;
        for (let i = 1; i < this.points.length; i++) {
            const dx = this.points[i].x - this.points[i - 1].x;
            const dy = this.points[i].y - this.points[i - 1].y;
            len += Math.sqrt(dx * dx + dy * dy);
        }
        return len;
    }

    /**
     * Get the primary angle of the stroke (start to end)
    */
    getAngle(): number {
        if (this.points.length < 2) return 0;
        const first = this.points[0];
        const last = this.points[this.points.length - 1];
        return Math.atan2(last.y - first.y, last.x - first.x);
    }

    /**
     * Check if stroke is roughly horizontal
    */
    isHorizontal(tolerance = 0.4): boolean {
        const angle = Math.abs(this.getAngle());
        return angle < tolerance || angle > Math.PI - tolerance;
    }

    /**
     * Check if stroke is roughly vertical
    */
    isVertical(tolerance = 0.4): boolean {
        const angle = Math.abs(this.getAngle());
        return Math.abs(angle - Math.PI / 2) < tolerance;
    }

    /**
     * Aspect ratio of the bounding box (width / height)
    */
    getAspectRatio(): number {
        const bb = this.getBoundingBox();
        if (bb.height === 0) return Infinity;
        return bb.width / bb.height;
    }
}

export class StrokeGroup {

    public strokes: Stroke[] = [];

    constructor(strokes?: Stroke[]) {
        if (strokes) this.strokes = strokes;
    }

    addStroke(stroke: Stroke): void {
        this.strokes.push(stroke);
    }

    getBoundingBox(): BoundingBox {
        if (this.strokes.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const stroke of this.strokes) {
            const bb = stroke.getBoundingBox();
            if (bb.minX < minX) minX = bb.minX;
            if (bb.minY < minY) minY = bb.minY;
            if (bb.maxX > maxX) maxX = bb.maxX;
            if (bb.maxY > maxY) maxY = bb.maxY;
        }

        const width = maxX - minX;
        const height = maxY - minY;

        return {
            minX, minY, maxX, maxY,
            width, height,
            centerX: minX + width / 2,
            centerY: minY + height / 2,
        };
    }

    getAllPoints(): Point[] {
        return this.strokes.flatMap(s => s.points);
    }

    /**
     * Render this stroke group to a 28x28 pixel array (for MNIST model input)
    */
    renderToGrid(size = 28): number[] {

        const bb = this.getBoundingBox();
        const grid = new Array(size * size).fill(0);

        if (bb.width === 0 && bb.height === 0) return grid;

        const pad = Math.max(bb.width, bb.height) * 0.1;
        const padMinX = bb.minX - pad;
        const padMinY = bb.minY - pad;
        const padW = bb.width + pad * 2;
        const padH = bb.height + pad * 2;

        const scale = (size - 4) / Math.max(padW, padH);
        const offsetX = (size - padW * scale) / 2;
        const offsetY = (size - padH * scale) / 2;

        for (const stroke of this.strokes) {
            for (let i = 1; i < stroke.points.length; i++) {
                const p0 = stroke.points[i - 1];
                const p1 = stroke.points[i];

                const dist = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
                const steps = Math.max(Math.ceil(dist * scale), 1);

                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const x = Math.round((p0.x + (p1.x - p0.x) * t - padMinX) * scale + offsetX);
                    const y = Math.round((p0.y + (p1.y - p0.y) * t - padMinY) * scale + offsetY);

                    if (x >= 0 && x < size && y >= 0 && y < size) {

                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                                    const idx = ny * size + nx;
                                    const val = dx === 0 && dy === 0 ? 1.0 : 0.6;
                                    grid[idx] = Math.min(1.0, grid[idx] + val);
                                }
                            }
                        }
                    }
                }
            }
        }

        return grid;
    }
}


export function boxesOverlapX(a: BoundingBox, b: BoundingBox, margin = 0): boolean {
    return a.minX - margin <= b.maxX && a.maxX + margin >= b.minX;
}


export function horizontalGap(a: BoundingBox, b: BoundingBox): number {
    if (a.maxX < b.minX) return b.minX - a.maxX;
    if (b.maxX < a.minX) return a.minX - b.maxX;
    return 0;
}
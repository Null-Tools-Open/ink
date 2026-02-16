import { Stroke, StrokeGroup, boxesOverlapX, horizontalGap, type BoundingBox } from './Stroke.js';

export class Segmenter {

    segment(strokes: Stroke[]): StrokeGroup[] {
        if (strokes.length === 0) return [];
        if (strokes.length === 1) return [new StrokeGroup([strokes[0]])];

        const boxes = strokes.map(s => s.getBoundingBox());
        const avgHeight = boxes.reduce((sum, b) => sum + b.height, 0) / boxes.length;
        const gapThreshold = Math.max(avgHeight * 0.5, 15);

        const indexed = strokes.map((s, i) => ({ stroke: s, box: boxes[i], index: i }));
        indexed.sort((a, b) => a.box.minX - b.box.minX);

        const parent = new Array(strokes.length).fill(0).map((_, i) => i);

        function find(x: number): number {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        }

        function union(a: number, b: number): void {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent[ra] = rb;
        }

        for (let i = 0; i < indexed.length; i++) {
            for (let j = i + 1; j < indexed.length; j++) {
                const a = indexed[i];
                const b = indexed[j];

                if (boxesOverlapX(a.box, b.box, gapThreshold * 0.3)) {
                    const yOverlap = this.yOverlapRatio(a.box, b.box);
                    if (yOverlap > 0.1) {
                        union(a.index, b.index);
                    }
                } else {
                    const gap = horizontalGap(a.box, b.box);
                    if (gap < gapThreshold && gap > 0) {
                        const yOverlap = this.yOverlapRatio(a.box, b.box);
                        if (yOverlap > 0.3) {
                            union(a.index, b.index);
                        }
                    }
                }
            }
        }

        const groupMap = new Map<number, Stroke[]>();
        for (let i = 0; i < strokes.length; i++) {
            const root = find(i);
            if (!groupMap.has(root)) {
                groupMap.set(root, []);
            }
            groupMap.get(root)!.push(strokes[i]);
        }

        const groups = Array.from(groupMap.values()).map(s => new StrokeGroup(s));
        groups.sort((a, b) => a.getBoundingBox().centerX - b.getBoundingBox().centerX);

        return groups;
    }

    /**
     * Calculate the Y-axis overlap ratio between two bounding boxes
    */
    private yOverlapRatio(a: BoundingBox, b: BoundingBox): number {
        const overlapStart = Math.max(a.minY, b.minY);
        const overlapEnd = Math.min(a.maxY, b.maxY);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        const minHeight = Math.min(a.height, b.height);
        if (minHeight === 0) return 0;
        return overlap / minHeight;
    }
}
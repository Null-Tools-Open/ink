export interface AugmentOptions {

    factor?: number;
    maxRotation?: number;
    maxShift?: number;
    scaleRange?: [number, number];
    noiseIntensity?: number;
}

const DEFAULT_OPTIONS: Required<AugmentOptions> = {

    factor: 5,
    maxRotation: 15,
    maxShift: 2,
    scaleRange: [0.85, 1.15],
    noiseIntensity: 0.05,
};

export class DataAugmentor {
    private opts: Required<AugmentOptions>;

    constructor(options?: AugmentOptions) {
        this.opts = { ...DEFAULT_OPTIONS, ...options };
    }

    augment(grid: number[]): number[][] {

        const results: number[][] = [grid];

        for (let i = 0; i < this.opts.factor; i++) {
            let augmented = this.applyRotation(grid, 28);
            augmented = this.applyShift(augmented, 28);
            augmented = this.applyScale(augmented, 28);
            augmented = this.applyNoise(augmented);
            results.push(augmented);
        }

        return results;
    }

    async augmentDataset(data: Record<string, number[][]>): Promise<Record<string, number[][]>> {

        const result: Record<string, number[][]> = {};
        let processedCount = 0;

        for (const [label, samples] of Object.entries(data)) {
            if (!Array.isArray(samples) || samples.length === 0) {
                result[label] = [];
                continue;
            }

            const augmented: number[][] = [];
            for (const sample of samples) {
                const variants = this.augment(sample);
                augmented.push(...variants);

                processedCount++;
                if (processedCount % 1000 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            result[label] = augmented;
        }

        return result;
    }

    /**
     * Apply random rotation (±maxRotation degrees) via bilinear interpolation
    */
    private applyRotation(grid: number[], size: number): number[] {

        const angle = (Math.random() * 2 - 1) * this.opts.maxRotation * (Math.PI / 180);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = size / 2;
        const cy = size / 2;
        const result = new Array(size * size).fill(0);

        for (let y = 0; y < size; y++) {

            for (let x = 0; x < size; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const srcX = cos * dx + sin * dy + cx;
                const srcY = -sin * dx + cos * dy + cy;

                result[y * size + x] = this.bilinearSample(grid, size, srcX, srcY);
            }
        }

        return result;
    }

    /**
     * Apply random translation (shift) by ±maxShift pixels
    */
    private applyShift(grid: number[], size: number): number[] {

        const shiftX = Math.round((Math.random() * 2 - 1) * this.opts.maxShift);
        const shiftY = Math.round((Math.random() * 2 - 1) * this.opts.maxShift);
        const result = new Array(size * size).fill(0);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const srcX = x - shiftX;
                const srcY = y - shiftY;
                if (srcX >= 0 && srcX < size && srcY >= 0 && srcY < size) {
                    result[y * size + x] = grid[srcY * size + srcX];
                }
            }
        }

        return result;
    }

    /**
     * Apply random scaling (zoom in/out) around center
    */
    private applyScale(grid: number[], size: number): number[] {

        const [minS, maxS] = this.opts.scaleRange;
        const scale = minS + Math.random() * (maxS - minS);
        const cx = size / 2;
        const cy = size / 2;
        const result = new Array(size * size).fill(0);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const srcX = (x - cx) / scale + cx;
                const srcY = (y - cy) / scale + cy;
                result[y * size + x] = this.bilinearSample(grid, size, srcX, srcY);
            }
        }

        return result;
    }

    /**
     * Apply random pixel noise
    */
    private applyNoise(grid: number[]): number[] {

        return grid.map(v => {
            const noised = v + (Math.random() * 2 - 1) * this.opts.noiseIntensity;
            return Math.max(0, Math.min(1, noised));
        });
    }

    /**
     * Bilinear interpolation for sub-pixel sampling
    */
    private bilinearSample(grid: number[], size: number, x: number, y: number): number {

        if (x < 0 || x >= size - 1 || y < 0 || y >= size - 1) return 0;

        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = x - x0;
        const fy = y - y0;

        const v00 = grid[y0 * size + x0] ?? 0;
        const v10 = grid[y0 * size + x1] ?? 0;
        const v01 = grid[y1 * size + x0] ?? 0;
        const v11 = grid[y1 * size + x1] ?? 0;

        return (
            v00 * (1 - fx) * (1 - fy) +
            v10 * fx * (1 - fy) +
            v01 * (1 - fx) * fy +
            v11 * fx * fy
        );
    }
}
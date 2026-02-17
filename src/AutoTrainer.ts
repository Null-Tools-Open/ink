import * as tf from '@tensorflow/tfjs';
import { DataAugmentor, type AugmentOptions } from './DataAugmentor.js';

export interface TrainOptions {

    epochs?: number
    batchSize?: number
    augmentFactor?: number
    augmentOptions?: AugmentOptions
    onProgress?: (epoch: number, totalEpochs: number, logs?: tf.Logs) => void
    validationSplit?: number
}

const DIGIT_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export class AutoTrainer {
    /**
     * Train a model from labeled grid data.
     *
     * @param model - A compiled tf.LayersModel (28×28 input, 10-class softmax output)
     * @param data  - Labeled training data: { "0": [grid[], ...], "1": [...], ... } Each grid is a flat array of 784 floats (28×28).
     * @param options - Training configuration
     * @returns Training history
    */
    async train(
        model: tf.LayersModel,
        data: Record<string, number[][]>,
        options?: TrainOptions,
    ): Promise<tf.History> {
        const opts: Required<TrainOptions> = {
            epochs: options?.epochs ?? 10,
            batchSize: options?.batchSize ?? 32,
            augmentFactor: options?.augmentFactor ?? 5,
            augmentOptions: options?.augmentOptions ?? {},
            onProgress: options?.onProgress ?? (() => { }),
            validationSplit: options?.validationSplit ?? 0.15,
        };

        const augmentor = new DataAugmentor({
            ...opts.augmentOptions,
            factor: opts.augmentFactor,
        });

        const augmented = await augmentor.augmentDataset(data);
        const xArrays: number[][] = [];
        const yLabels: number[] = [];

        for (const label of DIGIT_LABELS) {

            const samples = augmented[label];

            if (!samples || samples.length === 0) continue;

            const labelIndex = DIGIT_LABELS.indexOf(label);

            for (const grid of samples) {

                if (grid.length === 784) {

                    xArrays.push(grid);
                    yLabels.push(labelIndex);
                }
            }
        }

        if (xArrays.length === 0) {
            throw new Error('AutoTrainer: No valid training samples found. Need 28×28 (784) grids for digits 0-9.');
        }

        // 3. Shuffle
        const indices = Array.from({ length: xArrays.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const shuffledX = indices.map(i => xArrays[i]);
        const shuffledY = indices.map(i => yLabels[i]);

        // 4. Create tensors
        const xFlat = new Float32Array(shuffledX.length * 784);
        for (let i = 0; i < shuffledX.length; i++) {
            xFlat.set(shuffledX[i], i * 784);
        }

        const xTensor = tf.tensor4d(xFlat, [shuffledX.length, 28, 28, 1]);
        const yTensor = tf.oneHot(tf.tensor1d(shuffledY, 'int32'), 10);

        // 5. Train
        try {
            const history = await model.fit(xTensor, yTensor, {
                epochs: opts.epochs,
                batchSize: opts.batchSize,
                validationSplit: opts.validationSplit,
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch: number, logs?: tf.Logs) => {
                        opts.onProgress(epoch + 1, opts.epochs, logs);
                    },
                },
            });

            return history;
        } finally {
            // Clean up tensors
            xTensor.dispose();
            yTensor.dispose();
        }
    }

    /**
     * Get count of valid samples per label
    */
    static getSampleCounts(data: Record<string, number[][]>): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const label of DIGIT_LABELS) {
            const samples = data[label];
            counts[label] = samples?.filter(g => g.length === 784).length ?? 0;
        }
        return counts;
    }
}
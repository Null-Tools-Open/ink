export { Stroke, StrokeGroup, type Point, type BoundingBox } from './Stroke.js';
export { Segmenter } from './Segmenter.js';
export { Recognizer, type RecognitionResult } from './Recognizer.js';
export { Parser, type ParsedExpression } from './Parser.js';
export { Evaluator } from './Evaluator.js';
export { DataAugmentor, type AugmentOptions } from './DataAugmentor.js';
export { AutoTrainer, type TrainOptions } from './AutoTrainer.js';

import { Stroke, type Point } from './Stroke.js';
import { Segmenter } from './Segmenter.js';
import { Recognizer, type RecognitionResult } from './Recognizer.js';
import { Parser } from './Parser.js';
import { Evaluator } from './Evaluator.js';
import type { TrainOptions } from './AutoTrainer.js';
import type { Logs } from '@tensorflow/tfjs';

export interface InkResult {
    expression: string;
    rawExpression: string;
    result: number | null;
    characters: RecognitionResult[];
    valid: boolean;
}

export interface InkOptions {
    modelUrl?: string;
    /**
     * Enable auto-training from sample data (default: true).
     * When enabled and no modelUrl is provided, the model will be
     * trained on bundled/provided sample data during loadModel().
    */
    auto?: boolean;
    /**
     * Custom training data to use instead of the bundled default.
     * Format: { "0": [grid[], grid[], ...], "1": [...], ... }
     * Each grid is a flat array of 784 floats (28×28 pixel values).
    */
    trainingData?: Record<string, number[][]>;
    /** Number of training epochs (default: 10) */
    autoEpochs?: number;
    /** Augmentation factor – augmented copies per sample (default: 5) */
    autoAugmentFactor?: number;
    /** Callback for training progress */
    onTrainProgress?: (epoch: number, totalEpochs: number, logs?: Logs) => void;
}

export class Ink {
    private strokes: Stroke[] = [];
    private segmenter = new Segmenter();
    private recognizer = new Recognizer();
    private parser = new Parser();
    private evaluator = new Evaluator();
    private options: InkOptions;

    constructor(options?: InkOptions) {
        this.options = {
            auto: true, // default enabled
            ...options,
        };
    }

    /**
     * Load the digit recognition model (must be called before recognize).
     * If auto-training is enabled (default), the model will be trained
     * on sample data automatically.
    */
    async loadModel(): Promise<void> {
        if (this.options.modelUrl) {
            // Load a pre-trained model from URL (skip auto-training)
            await this.recognizer.loadModel(this.options.modelUrl);
            return;
        }

        // Create the model architecture
        await this.recognizer.loadModel();

        // Auto-training: train on sample data if enabled
        if (this.options.auto !== false) {
            let data = this.options.trainingData;

            // If no custom data provided, load the bundled default
            if (!data) {
                try {
                    const { loadDefaultTrainingData } = await import('./defaultData.js');
                    data = await loadDefaultTrainingData();
                } catch (err) {
                    console.warn('Ink: Could not load default training data for auto-training.', err);
                    return;
                }
            }

            // Check if we actually have any samples
            const hasData = Object.values(data).some(
                (samples) => Array.isArray(samples) && samples.length > 0
            );

            if (hasData) {
                const trainOpts: TrainOptions = {
                    epochs: this.options.autoEpochs ?? 10,
                    augmentFactor: this.options.autoAugmentFactor ?? 5,
                    onProgress: this.options.onTrainProgress,
                };

                try {
                    await this.recognizer.trainModel(data, trainOpts);
                } catch (err) {
                    console.warn('Ink: Auto-training failed.', err);
                }
            }
        }
    }

    /**
     * Check if the recognition model is loaded
    */
    isReady(): boolean {
        return this.recognizer.isModelLoaded();
    }

    /**
     * Start a new stroke – returns it to keep adding points to
    */
    startStroke(): Stroke {
        const stroke = new Stroke();
        this.strokes.push(stroke);
        return stroke;
    }

    /**
     * Add a complete stroke from an array of points
    */
    addStroke(points: Array<{ x: number; y: number; t?: number }>): Stroke {
        const stroke = new Stroke();
        for (const p of points) {
            stroke.addPoint(p.x, p.y, p.t);
        }
        this.strokes.push(stroke);
        return stroke;
    }

    /**
     * Remove the last added stroke (undo)
    */
    undo(): Stroke | undefined {
        return this.strokes.pop();
    }

    /**
     * Clear all strokes
    */
    clear(): void {
        this.strokes = [];
    }

    /**
     * Get all current strokes
    */
    getStrokes(): Stroke[] {
        return [...this.strokes];
    }

    /**
     * Get the number of strokes
    */
    get strokeCount(): number {
        return this.strokes.length;
    }

    /**
     * Recognize the drawn strokes and evaluate the math expression
    */
    async recognize(): Promise<InkResult> {
        if (this.strokes.length === 0) {
            return {
                expression: '',
                rawExpression: '',
                result: null,
                characters: [],
                valid: false,
            };
        }

        // 1. Segment strokes into character groups
        const groups = this.segmenter.segment(this.strokes);

        // 2. Recognize each group
        const characters: RecognitionResult[] = [];
        for (const group of groups) {
            const result = await this.recognizer.recognize(group);
            characters.push(result);
        }

        // 3. Parse into expression
        const parsed = this.parser.parse(characters);

        // 4. Evaluate if valid
        let result: number | null = null;
        if (parsed.isValid) {
            try {
                result = this.evaluator.evaluate(parsed.normalized);
                // Round to avoid floating point issues
                result = Math.round(result * 1e10) / 1e10;
            } catch {
                result = null;
            }
        }

        return {
            expression: parsed.normalized,
            rawExpression: parsed.raw,
            result,
            characters,
            valid: parsed.isValid,
        };
    }
}

export default Ink;
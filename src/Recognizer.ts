import * as tf from '@tensorflow/tfjs';
import { StrokeGroup, type BoundingBox } from './Stroke.js';
import { AutoTrainer, type TrainOptions } from './AutoTrainer.js';

export interface RecognitionResult {
    char: string;
    confidence: number;
    type: 'digit' | 'operator';
}

export class Recognizer {
    private model: tf.LayersModel | null = null;
    private modelLoaded = false;

    async loadModel(modelUrl?: string): Promise<void> {
        if (this.modelLoaded) return;

        try {
            if (modelUrl) {
                this.model = await tf.loadLayersModel(modelUrl);
            } else {
                this.model = this.createModel();
            }
            this.modelLoaded = true;
        } catch (err) {
            console.warn('Ink: Failed to load MNIST model, falling back to heuristic recognition', err);
            this.model = null;
        }
    }

    /**
     * Create a simple CNN model architecture for MNIST
    */
    private createModel(): tf.LayersModel {
        const model = tf.sequential();

        model.add(tf.layers.conv2d({
            inputShape: [28, 28, 1],
            kernelSize: 3,
            filters: 32,
            activation: 'relu',
        }));
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
        model.add(tf.layers.conv2d({
            kernelSize: 3,
            filters: 64,
            activation: 'relu',
        }));
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
        model.add(tf.layers.flatten());
        model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'],
        });

        return model;
    }

    /**
     * Recognize a stroke group as either a digit or operator
    */
    async recognize(group: StrokeGroup): Promise<RecognitionResult> {

        const operatorResult = this.recognizeOperator(group)

        if (operatorResult && operatorResult.confidence > 0.6) {
            return operatorResult;
        }

        if (this.model && this.modelLoaded) {
            const digitResult = await this.recognizeDigit(group);

            if (operatorResult && operatorResult.confidence > digitResult.confidence) {
                return operatorResult;
            }

            return digitResult;
        }

        // Fallback: return best operator guess or unknown
        if (operatorResult) return operatorResult;
        return { char: '?', confidence: 0, type: 'digit' };
    }

    /**
     * Recognize a digit using the MNIST model
    */
    private async recognizeDigit(group: StrokeGroup): Promise<RecognitionResult> {
        const grid = group.renderToGrid(28);

        const result = tf.tidy(() => {
            const tensor = tf.tensor(grid, [1, 28, 28, 1]);
            const prediction = this.model!.predict(tensor) as tf.Tensor;
            return prediction.dataSync();
        });

        let maxIdx = 0;
        let maxVal = 0;
        for (let i = 0; i < result.length; i++) {
            if (result[i] > maxVal) {
                maxVal = result[i];
                maxIdx = i;
            }
        }

        return {
            char: String(maxIdx),
            confidence: maxVal,
            type: 'digit',
        };
    }

    /**
     * Recognize operators using heuristic stroke analysis
    */
    recognizeOperator(group: StrokeGroup): RecognitionResult | null {
        const strokes = group.strokes;
        const bb = group.getBoundingBox();
        const numStrokes = strokes.length;

        // = sign: two parallel horizontal strokes
        if (numStrokes === 2) {
            const s0 = strokes[0];
            const s1 = strokes[1];
            if (s0.isHorizontal() && s1.isHorizontal()) {
                const bb0 = s0.getBoundingBox();
                const bb1 = s1.getBoundingBox();
                const verticalGap = Math.abs(bb0.centerY - bb1.centerY);
                const avgWidth = (bb0.width + bb1.width) / 2;

                // Two horizontal lines stacked vertically, similar width
                if (verticalGap > 3 && verticalGap < avgWidth * 1.5) {
                    const widthRatio = Math.min(bb0.width, bb1.width) / Math.max(bb0.width, bb1.width);
                    if (widthRatio > 0.4) {
                        return { char: '=', confidence: 0.85, type: 'operator' };
                    }
                }
            }
        }

        // + sign: two strokes crossing, one horizontal and one vertical
        if (numStrokes === 2) {
            const s0 = strokes[0];
            const s1 = strokes[1];
            const oneH = s0.isHorizontal() || s1.isHorizontal();
            const oneV = s0.isVertical() || s1.isVertical();

            if (oneH && oneV) {
                // Check that they cross near their centers
                const bb0 = s0.getBoundingBox();
                const bb1 = s1.getBoundingBox();
                const centerDist = Math.sqrt(
                    (bb0.centerX - bb1.centerX) ** 2 + (bb0.centerY - bb1.centerY) ** 2
                );
                const avgSize = (Math.max(bb0.width, bb0.height) + Math.max(bb1.width, bb1.height)) / 2;

                if (centerDist < avgSize * 0.5) {
                    return { char: '+', confidence: 0.85, type: 'operator' };
                }
            }
        }

        // - sign: single horizontal stroke with wide aspect ratio
        if (numStrokes === 1) {
            const s = strokes[0];
            if (s.isHorizontal()) {
                const ratio = s.getAspectRatio();
                if (ratio > 2.5) {
                    return { char: '-', confidence: 0.8, type: 'operator' };
                }
            }
        }

        // × (multiply): two diagonal crossing strokes
        if (numStrokes === 2) {
            const s0 = strokes[0];
            const s1 = strokes[1];
            const a0 = Math.abs(s0.getAngle());
            const a1 = Math.abs(s1.getAngle());

            // Both diagonal (not horizontal, not vertical)
            const isDiag0 = a0 > 0.4 && a0 < 1.2;
            const isDiag1 = a1 > 0.4 && a1 < 1.2;
            // Or one going up-right and other going down-right
            const isDiag0b = (Math.PI - a0) > 0.4 && (Math.PI - a0) < 1.2;
            const isDiag1b = (Math.PI - a1) > 0.4 && (Math.PI - a1) < 1.2;

            if ((isDiag0 || isDiag0b) && (isDiag1 || isDiag1b)) {
                return { char: '*', confidence: 0.7, type: 'operator' };
            }
        }

        // ÷ (divide): horizontal stroke with a dot above and below (3 strokes)
        if (numStrokes === 3) {
            // Find the horizontal stroke and the two dots
            const horizontals = strokes.filter(s => s.isHorizontal() && s.getAspectRatio() > 2);
            const dots = strokes.filter(s => {
                const sbb = s.getBoundingBox();
                return sbb.width < bb.width * 0.4 && sbb.height < bb.height * 0.4;
            });

            if (horizontals.length === 1 && dots.length >= 2) {
                return { char: '/', confidence: 0.75, type: 'operator' };
            }
        }

        if (numStrokes === 1) {

            const angle = strokes[0].getAngle();

            if (angle < -0.5 && angle > -1.3) {

                const ratio = strokes[0].getAspectRatio();

                if (ratio > 0.5 && ratio < 3) {

                    return { char: '/', confidence: 0.65, type: 'operator' };
                }
            }
        }

        return null;
    }

    isModelLoaded(): boolean {
        return this.modelLoaded;
    }

    /**
     * Get the internal TF.js model (for auto-training)
    */
    getModel(): tf.LayersModel | null {
        return this.model;
    }

    /**
     * Train the internal model with labeled sample data.
     * If no model exists yet, creates one first.
    */
    async trainModel(
        data: Record<string, number[][]>,
        options?: TrainOptions,
    ): Promise<tf.History | null> {
        if (!this.model) {
            this.model = this.createModel();
            this.modelLoaded = true;
        }

        const trainer = new AutoTrainer();
        return trainer.train(this.model, data, options);
    }
}
export type TrainingDataset = Record<string, number[][]>;

/**
 * Load the default training data bundled with the package
 * The data is a JSON object with digit labels ("0"-"9") as keys,
 * each containing arrays of 28×28 flat grids.
*/
export async function loadDefaultTrainingData(): Promise<TrainingDataset> {

    try {
        const data = await import('../data/trained/points.json', { assert: { type: 'json' } });
        return data.default as TrainingDataset;
    } catch {
        try {
            const response = await fetch(new URL('../data/trained/points.json', import.meta.url).href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json() as TrainingDataset;
        } catch (fetchErr) {
            console.warn('Ink: Could not load default training data.', fetchErr);
            return {};
        }
    }
}
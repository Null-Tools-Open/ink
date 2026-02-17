# @impulsedev/ink

A powerful, lightweight handwriting math recognition library for the web.

`@impulsedev/ink` recognizes handwritten digits (0-9) and mathematical operators (+, -, *, /, =, etc.), evaluates expressions, and works entirely in the browser. It features a unique **auto-training** capability that trains a lightweight CNN model on the client-side using bundled sample data, eliminating the need for complex server setups or large pre-trained model files.

## Features

- **Math Recognition**: Detects digits, operators, and basic mathematical expressions.
- **Auto-Training**: Zero-config setup. Automatically trains a model in the browser on the first run using bundled data (~3MB).
- **Expression Evaluation**: Parses recognized characters into valid mathematical expressions and calculates the result.
- **Stroke Management**: Built-in utilities for capturing strokes, segmentation, and undo/redo functionality.
- **TypeScript Support**: Fully typed API for an excellent developer experience.
- **Data Augmentation**: Generates diverse training samples from a base set for better accuracy.

## Installation

```bash
npm install @impulsedev/ink
```

## Quick Start

Here's a minimal example to get you up and running:

```typescript
import { Ink } from '@impulsedev/ink';

// Initialize the library
// By default, this will start auto-training the model in the background
const ink = new Ink();

// Load the model (or wait for auto-training to complete)
await ink.loadModel();

// ... (setup your canvas and capture strokes) ...

// Recognize the drawing
const result = await ink.recognize();

if (result.valid) {
  console.log(`Expression: ${result.expression}`); // e.g., "2 + 2"
  console.log(`Result: ${result.result}`);         // e.g., 4
}
```

## Usage

### Capturing Strokes

The `Ink` class provides helper methods to manage stroke data, making it easy to integrate with an HTML Canvas.

```typescript
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const ink = new Ink();

let isDrawing = false;

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  // Start a new stroke
  const stroke = ink.startStroke();
  stroke.addPoint(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  // Add points to the current stroke
  // The library automatically handles the current active stroke
  const strokes = ink.getStrokes();
  const currentStroke = strokes[strokes.length - 1];
  currentStroke.addPoint(e.offsetX, e.offsetY);
  
  // Draw on canvas for visual feedback...
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
});
```

### Auto-Training Configuration

The library's standout feature is its ability to train itself. You can customize this behavior via the `InkOptions`:

```typescript
const ink = new Ink({
  auto: true,                // Enable/disable auto-training (default: true)
  autoEpochs: 20,            // Number of training epochs (default: 10)
  autoAugmentFactor: 5,      // How many augmented copies per sample (default: 5)
  onTrainProgress: (epoch, total, logs) => {
    // track training progress
    console.log(`Training: ${Math.round(epoch / total * 100)}%`);
  }
});
```

If you prefer to load a pre-trained model instead of training on the client:

```typescript
const ink = new Ink({
  modelUrl: '/path/to/my/model.json', // URL to a TensorFlow.js model
  auto: false
});
```

## API Reference

### `Ink` Class

The main entry point for the library.

#### Constructor

```typescript
new Ink(options?: InkOptions)
```

**`InkOptions`**:
- `auto` (boolean): Enable auto-training from sample data (default: `true`).
- `modelUrl` (string): URL to load a pre-trained model from.
- `trainingData` (Record<string, number[][]>): Custom training data.
- `autoEpochs` (number): Number of training epochs (default: `10`).
- `autoAugmentFactor` (number): Augmentation factor (default: `5`).
- `onTrainProgress` (function): Callback for training progress.

#### Methods

- **`async loadModel(): Promise<void>`**
  Initializes the recognition engine. If `auto` is true and no `modelUrl` is provided, this triggers the client-side training process.

- **`isReady(): boolean`**
  Returns `true` if the model is loaded and ready for recognition.

- **`startStroke(): Stroke`**
  Creates and returns a new `Stroke` object. Subsequent points should be added to this stroke.

- **`addStroke(points: Point[]): Stroke`**
  Adds a complete stroke from an array of points (`{x, y, t}`).

- **`undo(): Stroke | undefined`**
  Removes the last added stroke. Useful for implementing an "Undo" button.

- **`clear(): void`**
  Removes all strokes.

- **`getStrokes(): Stroke[]`**
  Returns an array of all current `Stroke` objects.

- **`async recognize(): Promise<InkResult>`**
  Processes the current strokes and attempts to recognize the mathematical expression.

### `InkResult` Interface

The result object returned by `recognize()`:

```typescript
interface InkResult {
  expression: string;       // Normalized expression (e.g., "2 + 2")
  rawExpression: string;    // Raw recognized characters
  result: number | null;    // Calculated result (e.g., 4), or null if invalid
  characters: RecognitionResult[]; // Detailed recognition data for each character
  valid: boolean;           // Whether the expression is valid math
}
```

## License

ISC

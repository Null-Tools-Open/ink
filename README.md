# @impulsedev/ink

A lightweight handwriting math recognition library (digits, operators, expressions) with built-in auto-training capability.

## Features

- **Math Recognition**: Recognizes digits (0-9) and basic operators (+, -, *, /, =, etc.).
- **Auto-Training**: Automatically trains a CNN model in the browser using bundled sample data on first run.
- **Expression Parsing**: Converts strokes into mathematical expressions and evaluates them.
- **Data Augmentation**: Generates diverse training samples from a base set for better accuracy.

## Installation

```bash
npm install @impulsedev/ink
```

## Usage

```typescript
import { Ink } from '@impulsedev/ink';

// Initialize (starts auto-training by default)
const ink = new Ink({
    // Optional configuration
    auto: true,
    onTrainProgress: (epoch, total, logs) => {
        console.log(`Training: ${Math.round(epoch/total * 100)}%`);
    }
});

// Load the model (triggers training if needed)
await ink.loadModel();

// Start checking for strokes
canvas.addEventListener('mousedown', (e) => {
    const stroke = ink.startStroke();
    stroke.addPoint(e.x, e.y);
    // ... add points on mousemove
});

// Recognize
const result = await ink.recognize();
console.log(result.expression);
console.log(result.result);
```

## Auto-Training

By default, the library loads a bundled dataset (~3MB) and trains a lightweight CNN model in the browser when `loadModel()` is called. This ensures good accuracy without needing extensive server-side training or large pre-trained model files.

To disable auto-training or provide your own data:

```typescript
const ink = new Ink({ auto: false });
// or
const ink = new Ink({ 
    trainingData: myCustomData, // { "0": [...], "1": [...] }
    autoEpochs: 20
});
```

## License

ISC